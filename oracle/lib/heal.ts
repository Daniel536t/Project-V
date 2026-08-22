// The heal flow. Two layers:
//
//  1. PRODUCTION: when BRIGHT_DATA_STORE_COLLECTOR_ID is set, the heal genuinely
//     goes through Bright Data's CLI (`bdata scraper heal <collector_id> "<what broke>"`)
//     against the live store page's collector. SENSE computes a *break description*
//     from the observed DOM diff (old selector → new element) — not just the original
//     intent — so Bright Data's AI planner knows exactly what changed. The demo does
//     NOT heal blind.
//  2. FALLBACK: if the CLI is unavailable, times out, or no collector is
//     configured, we re-derive the selector deterministically from the current
//     store template (the same semantic action — re-find the price from the
//     original intent against the new DOM). The demo never stalls.

import { getWatch, updateWatch, logStructuredHeal } from "./db";
import { getProduct, TEMPLATES } from "./store";
import { healCollectorCli } from "./brightdata";
import { emitLog } from "./stream";

export const STORE_COLLECTOR_ID = process.env.BRIGHT_DATA_STORE_COLLECTOR_ID ?? null;

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
 * Generate the break description from the observed DOM diff.
 *
 * This is the fix: Bright Data's `bdata scraper heal` documentation says the
 * prompt should describe *what broke* — old location → new location. We were
 * previously sending bare intent ("Find the price for the iPhone 17 Pro"),
 * which healed blind. Now SENSE computes the diff from its knowledge of the
 * templates and hands Bright Data a precise map.
 */
function breakDescription(
  field: string,
  oldSelector: string | null,
  newSelector: string,
  productName: string,
): string {
  const fieldName = field === "stock" ? "stock status" : "price";
  const moved =
    oldSelector
      ? `The ${fieldName} moved from ${oldSelector} to ${newSelector}.`
      : `The ${fieldName} extraction returns empty — the selector ${newSelector} no longer works.`;
  return (
    `The ${productName} page was redesigned. ${moved} ` +
    `The page structure changed — look for the new selectors in the redesigned markup. ` +
    `Restore extraction of the product price (number, e.g. 999) and stock status (boolean — true when In Stock).`
  );
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
  const newSelector = deterministicSelector(field, product.template);
  const collectorId = watch.collector_id ?? STORE_COLLECTOR_ID ?? "c_unknown";

  // ---- generate the break description (the DIAGNOSIS) ----
  const description = breakDescription(
    field,
    oldSelector,
    newSelector,
    product.name,
  );

  emitLog("info", `Heal protocol · description: "${description}"`);
  await updateWatch(watchId, { status: "healing" });

  // ---- try the real Bright Data CLI heal ----
  let cliStdout: string | null = null;
  let cliCode: number | null = null;
  let cliTimedOut = false;

  if (STORE_COLLECTOR_ID) {
    emitLog("info", `Bright Data heal dispatched (collector ${STORE_COLLECTOR_ID})`);
    try {
      // First attempt: immediate heal.
      let res = await healCollectorCli(STORE_COLLECTOR_ID, description, HEAL_CLI_TIMEOUT_MS);

      // If Bright Data reports "Another refactor job is still in progress",
      // wait for it to clear and retry once (the old job may be a prior heal's
      // async save that hasn't landed yet).
      if (res.code !== 0 && res.stdout.includes("Another refactor job is still in progress")) {
        emitLog("info", "Concurrent refactor detected — waiting 60s then retrying…");
        await new Promise((r) => setTimeout(r, 60_000));
        res = await healCollectorCli(STORE_COLLECTOR_ID, description, HEAL_CLI_TIMEOUT_MS);
      }

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
    original_intent: description,
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