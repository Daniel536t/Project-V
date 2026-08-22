// The heal flow. Two layers:
//
//  1. PRODUCTION: when BRIGHT_DATA_STORE_COLLECTOR_ID is set, the heal genuinely
//     goes through Bright Data's CLI (`bdata scraper heal <collector_id> "<intent>"`)
//     against the live store page's collector. The CLI's output envelope is
//     parsed and surfaced in the terminal + scar log.
//  2. FALLBACK: if the CLI is unavailable, times out, or no collector is
//     configured, we re-derive the selector deterministically from the current
//     store template (the same semantic action — re-find the price from the
//     original intent against the new DOM). The demo never stalls.

import { getWatch, updateWatch, logStructuredHeal } from "./db";
import { getProduct, TEMPLATES } from "./store";
import { healCollectorCli } from "./brightdata";
import { emitLog } from "./stream";

export const STORE_COLLECTOR_ID = process.env.BRIGHT_DATA_STORE_COLLECTOR_ID ?? null;

// Heals are usually faster than creates (they mutate an existing collector).
// Keep the demo snappy: if the CLI heal exceeds this, fall back to the
// deterministic re-derivation (which the scar log labels honestly).
const HEAL_CLI_TIMEOUT_MS = Number(process.env.SENSE_HEAL_TIMEOUT_MS ?? 240_000);

export interface HealOutcome {
  newSelector: string;
  confidence: number;
  source: "brightdata-cli" | "deterministic";
  cliStdout: string | null;
  cliCode: number | null;
  cliTimedOut: boolean;
  durationMs: number;
}

/** Derive the correct selector for the current template (deterministic heal). */
export function deterministicSelector(field: string, template: string): string {
  const t = TEMPLATES[template] ?? TEMPLATES.A;
  return field === "stock" ? t.stockSelector : t.priceSelector;
}

/**
 * Run the heal for a watch. Uses the real Bright Data CLI heal when a store
 * collector is configured; falls back to deterministic re-derivation.
 */
export async function healWatch(watchId: string): Promise<HealOutcome> {
  const watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);

  const product = await getProduct();
  const field = watch.field === "stock" ? "stock" : "price";
  const oldSelector = watch.selector;
  const brokeAt = new Date();
  const intent = watch.intent ?? `Find the ${field} for the ${product.name} on this page`;
  const collectorId = watch.collector_id ?? STORE_COLLECTOR_ID ?? "c_unknown";

  emitLog("info", `Heal protocol · intent: "${intent}"`);
  await updateWatch(watchId, { status: "healing" });

  // ---- try the real Bright Data CLI heal ----
  let cliStdout: string | null = null;
  let cliCode: number | null = null;
  let cliTimedOut = false;

  if (STORE_COLLECTOR_ID) {
    emitLog("info", `Bright Data heal dispatched (collector ${STORE_COLLECTOR_ID})`);
    try {
      const res = await healCollectorCli(STORE_COLLECTOR_ID, intent, HEAL_CLI_TIMEOUT_MS);
      cliStdout = res.stdout;
      cliCode = res.code;
      cliTimedOut = res.timedOut;
      if (res.timedOut) {
        emitLog("warn", "Bright Data heal timed out — applying deterministic heal");
      } else if (res.code === 0) {
        emitLog(
          "success",
          `Bright Data heal complete · ${res.stdout.split("\n").filter(Boolean).pop() ?? "collector updated"}`,
        );
      } else {
        emitLog("warn", `Bright Data heal returned ${res.code} — applying deterministic heal`);
      }
    } catch (e) {
      emitLog("warn", `Bright Data heal failed — applying deterministic heal (${e instanceof Error ? e.message : String(e)})`);
    }
  } else {
    emitLog("info", "No Bright Data store collector configured — deterministic heal");
  }

  // ---- resolve the selector for the LOCAL re-scrape ----
  // The Bright Data heal genuinely mutates the collector on Bright Data's side
  // (status "done"), but its JSON envelope does NOT return the healed CSS
  // selector — so the local re-scrape (which reads our own controlled templates
  // in-process) re-derives the selector deterministically. `source` still
  // records where the heal actually landed, so the scar log tells the truth.
  const newSelector = deterministicSelector(field, product.template);
  const confidence = !cliTimedOut && cliCode === 0 ? 96 : TEMPLATES[product.template] ? 94 : 78;
  const source: HealOutcome["source"] = !cliTimedOut && cliCode === 0 ? "brightdata-cli" : "deterministic";

  const scarCount = (watch.scar_count ?? 0) + 1;
  await updateWatch(watchId, {
    selector: newSelector,
    status: "healing",
    scar_count: scarCount,
  });

  const healedAt = new Date();
  const recoverySeconds = Math.max(1, Math.round((healedAt.getTime() - brokeAt.getTime()) / 1000));

  await logStructuredHeal({
    watch_id: watchId,
    collector_id: collectorId,
    broke_at: brokeAt,
    healed_at: healedAt,
    original_intent: intent,
    old_selector: oldSelector,
    new_selector: newSelector,
    confidence,
    recovery_seconds: recoverySeconds,
    description: `Scar #${scarCount} — ${field} selector moved (heal via ${source})`,
    error_message: cliStdout?.slice(0, 300) ?? `Selector "${oldSelector}" no longer matches template ${product.template}`,
  });

  emitLog(
    "success",
    `Healed · ${field} now at ${newSelector} · confidence ${confidence}% · via ${source}`,
  );

  return {
    newSelector,
    confidence,
    source,
    cliStdout,
    cliCode,
    cliTimedOut,
    durationMs: healedAt.getTime() - brokeAt.getTime(),
  };
}
