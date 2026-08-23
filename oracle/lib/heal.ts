// SENSE heal orchestration.
//
// TWO-TIER RECOVERY:
//   1. DETERMINISTIC (instant, <100ms): compute the correct selector for the
//      current template. This is always right because we control the store.
//      The scraper resumes immediately — no downtime.
//   2. BRIGHT DATA (background, 60–120s): dispatch a real bdata scraper heal
//      so the collector sees the new template. If it lands, the scar entry is
//      upgraded from "local-fallback" to "bright-data". If it doesn't land,
//      the scar already has a valid selector from tier 1.
//
// This design solves the "rapid template flipping" problem: clicking A→B→C→A
// in 5 seconds now works — each flip recovers instantly, and Bright Data
// catches up in the background with a gated single attempt.

import { getWatch, updateWatch, logStructuredHeal } from "./db";
import { getProduct, TEMPLATES } from "./store";
import {
  healCollectorCli,
  type HealCliResult,
} from "./brightdata";
import {
  scrapeStore,
  type ExtractField,
  type ScrapeOutcome,
} from "./scraper";
import { emitLog } from "./stream";

export const STORE_COLLECTOR_ID = process.env.BRIGHT_DATA_STORE_COLLECTOR_ID ?? null;

const HEAL_CLI_TIMEOUT_MS = Number(process.env.SENSE_HEAL_TIMEOUT_MS ?? 240_000);
const REFRESH_WAIT_MS = 45_000;
const POLL_INTERVAL_MS = 15_000;
const POLL_ATTEMPTS = 4;

export interface HealOutcome {
  newSelector: string;
  confidence: number;
  source: "brightdata-cli" | "deterministic";
  cliStdout: string | null;
  cliCode: number | null;
  cliTimedOut: boolean;
  durationMs: number;
  attemptedHeals: number;
  recoveryPath: "bright-data" | "local-fallback";
  landed: boolean;
  verifiedOutcome: ScrapeOutcome | null;
}

/** Derive the correct selector for the current template (deterministic heal). */
export function deterministicSelector(field: string, template: string): string {
  const t = TEMPLATES[template] ?? TEMPLATES.A;
  return field === "stock" ? t.stockSelector : t.priceSelector;
}

function selectorForPrompt(selector: string | null): string {
  if (!selector) return "the original selector";
  return selector
    .replace(".product-container .price", "span.price")
    .replace(".product-container .stock-status", "span.stock-status")
    .replace(".pricing-section [data-test='current-price']", "span[data-test='current-price']")
    .replace(".availability-badge", "span.availability-badge")
    .replace(".display-price", "span.display-price");
}

function breakDescription(
  field: string,
  oldSelector: string | null,
  newSelector: string,
  productName: string,
): string {
  const fieldName = field === "stock" ? "stock status" : "price";
  const oldLocation = selectorForPrompt(oldSelector);
  const newLocation = selectorForPrompt(newSelector);
  return (
    `The ${productName} site was redesigned. ${fieldName === "price" ? "Price extraction" : "Stock extraction"} returns empty. ` +
    `The ${fieldName} moved from ${oldLocation} to a new location near ${newLocation}. ` +
    `Restore extraction of name, price, stock status.`
  );
}

// ---- Concurrent-job gate ----

function isJobBusy(stdout: string): boolean {
  return /Another (?:refresh|refactor) job is (?:already|still) in progress/i.test(stdout);
}

function cliDone(result: HealCliResult): boolean {
  if (result.code !== 0 || result.timedOut) return false;
  const text = result.stdout ?? "";
  return /"status"\s*:\s*"done"/.test(text) && /save_new_template/.test(text);
}

function expectedValueIsValid(
  outcome: ScrapeOutcome,
  expectedPrice: number,
): boolean {
  return (
    !outcome.broke &&
    outcome.price != null &&
    Math.abs(outcome.price - expectedPrice) < 0.01 &&
    outcome.inStock != null
  );
}

async function waitForRefreshAndPoll(
  field: ExtractField,
  expectedPrice: number,
): Promise<ScrapeOutcome | null> {
  await new Promise((resolve) => setTimeout(resolve, REFRESH_WAIT_MS));

  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    emitLog("info", `⏳ Template refreshing… (attempt ${attempt}/${POLL_ATTEMPTS})`);
    const outcome = await scrapeStore(field);
    if (expectedValueIsValid(outcome, expectedPrice)) {
      return outcome;
    }
    if (attempt < POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  return null;
}

// ---- Background Bright Data verification ----

async function backgroundBrightDataHeal(
  watchId: string,
  collectorId: string,
  description: string,
  field: ExtractField,
  expectedPrice: number,
  newSelector: string,
  oldSelector: string | null,
  scarCount: number,
): Promise<void> {
  if (!STORE_COLLECTOR_ID) return;

  // Single attempt, no retries — the deterministic selector already saved us.
  // If the heal lands, upgrade the scar. If not, it's already logged honestly.
  const bgMsg = `🧪 Background Bright Data heal · collector ${STORE_COLLECTOR_ID}`;
  emitLog("info", bgMsg);
  console.log(bgMsg); // visible in pm2 logs

  try {
    const result = await healCollectorCli(STORE_COLLECTOR_ID, description, HEAL_CLI_TIMEOUT_MS);

    if (isJobBusy(result.stdout)) {
      emitLog("info", "⏳ Bright Data background heal skipped — refresh job already running");
      return;
    }

    if (!cliDone(result)) {
      emitLog("info", "Bright Data background heal did not complete — scar stays as local-fallback");
      return;
    }

    emitLog("success", "✅ Bright Data background heal saved · verifying…");
    const verified = await waitForRefreshAndPoll(field, expectedPrice);

    if (verified) {
      // Upgrade the scar entry from local-fallback to bright-data
      emitLog("success", `✅ Bright Data verification passed · upgrading scar #${scarCount}`);
      await logStructuredHeal({
        watch_id: watchId,
        collector_id: collectorId,
        broke_at: new Date(),
        healed_at: new Date(),
        original_intent: description,
        old_selector: oldSelector,
        new_selector: newSelector,
        confidence: 96,
        recovery_seconds: Math.round((REFRESH_WAIT_MS + POLL_INTERVAL_MS * POLL_ATTEMPTS) / 1000),
        attempted_heals: 1,
        recovery_path: "bright-data",
        description: `Scar #${scarCount} · upgraded from local-fallback → bright-data by background verification`,
        error_message: null,
      });
    } else {
      emitLog("info", "Bright Data verification did not land — scar stays as local-fallback (selector already recovered)");
    }
  } catch (err) {
    const errMsg = `Bright Data background heal failed: ${err instanceof Error ? err.message : String(err)}`;
    emitLog("error", errMsg);
    console.error(errMsg); // visible in pm2 logs
  }
}

// ---- Main heal entry point ----

export async function healWatch(watchId: string): Promise<HealOutcome> {
  const watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);

  const product = await getProduct();
  const field: ExtractField = watch.field === "stock" ? "stock" : "price";
  const oldSelector = watch.selector;
  const newSelector = deterministicSelector(field, product.template);
  const collectorId = watch.collector_id ?? STORE_COLLECTOR_ID ?? "c_unknown";
  const expectedPrice = Number(product.price);
  const startedAt = Date.now();

  emitLog("info", `Heal protocol · selector: ${oldSelector ?? "(none)"} → ${newSelector} (template ${product.template})`);
  await updateWatch(watchId, { status: "healing" });

  // ---- TIER 1: deterministic recovery (instant) ----
  // We know the correct selector for the current template. Apply it NOW.
  // The scraper resumes on the next tick — zero waiting.
  const tier1DurationMs = Date.now() - startedAt;
  const scarCount = (watch.scar_count ?? 0) + 1;

  await updateWatch(watchId, {
    selector: newSelector,
    status: "healing",
    scar_count: scarCount,
  });

  const description = breakDescription(field, oldSelector, newSelector, product.name);

  // Write the initial scar entry as local-fallback. The background task
  // upgrades it to bright-data if verification lands.
  await logStructuredHeal({
    watch_id: watchId,
    collector_id: collectorId,
    broke_at: new Date(startedAt),
    healed_at: new Date(),
    original_intent: description,
    old_selector: oldSelector,
    new_selector: newSelector,
    confidence: 94,
    recovery_seconds: Math.max(1, Math.round(tier1DurationMs / 1000)),
    attempted_heals: 0,
    recovery_path: "local-fallback",
    description: `Scar #${scarCount} · deterministic selector recovery · ${oldSelector ?? "(none)"} → ${newSelector}`,
    error_message: null,
  });

  emitLog(
    "success",
    `Scar #${scarCount} · selector recovered · ${oldSelector ?? "(none)"} → ${newSelector} (${Math.max(1, Math.round(tier1DurationMs / 1000))}s)`,
  );

  // ---- TIER 2: Bright Data verification (background) ----
  // Fire-and-forget — does NOT block the scrape pass. The scar entry is
  // already written; if Bright Data lands, it gets upgraded.
  if (STORE_COLLECTOR_ID) {
    backgroundBrightDataHeal(
      watchId,
      collectorId,
      description,
      field,
      expectedPrice,
      newSelector,
      oldSelector,
      scarCount,
    ).catch((err) => {
      emitLog("error", `Background Bright Data heal crashed: ${err}`);
    });
  }

  return {
    newSelector,
    confidence: 94,
    source: "deterministic",
    cliStdout: null,
    cliCode: null,
    cliTimedOut: false,
    durationMs: tier1DurationMs,
    attemptedHeals: 0,
    recoveryPath: "local-fallback",
    landed: false,
    verifiedOutcome: null,
  };
}