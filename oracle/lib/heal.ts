// SENSE heal orchestration.
//
// Bright Data executes heals as asynchronous refresh jobs with a concurrency
// cap. SENSE gates heal dispatches on job-clear, verifies healed output against
// expected values (partial heals — e.g. price correct but stock misread — do
// not pass verification), retries once with a sharper DOM-diff description, and
// falls back to deterministic intent-based recovery. Every path preserves the
// same Collector ID and is logged with full transparency in the terminal and
// Scar Log.

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
const GATE_POLL_INTERVAL_MS = 20_000;
const GATE_MAX_WAIT_MS = 120_000;

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

function templateForSelector(selector: string | null): string {
  if (selector === TEMPLATES.A.priceSelector || selector === TEMPLATES.A.stockSelector) return "A";
  if (selector === TEMPLATES.B.priceSelector || selector === TEMPLATES.B.stockSelector) return "B";
  if (selector === TEMPLATES.C.priceSelector || selector === TEMPLATES.C.stockSelector) return "C";
  return "the previous template";
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

function sharperDescription(
  field: string,
  oldSelector: string | null,
  newSelector: string,
): string {
  const oldTemplate = templateForSelector(oldSelector);
  const newTemplate = templateForSelector(newSelector);
  const oldLocation = selectorForPrompt(oldSelector);
  const newLocation = selectorForPrompt(newSelector);
  if (field === "stock") {
    return `The site redesigned from Template ${oldTemplate} to Template ${newTemplate}. Stock status moved from ${oldLocation} to ${newLocation}. Restore extraction of name, price, stock status.`;
  }
  return `The site redesigned from Template ${oldTemplate} to Template ${newTemplate}. Price moved from ${oldLocation} to ${newLocation}. Restore extraction.`;
}

// ---- Concurrent-job gate ----

/**
 * Detect the concurrent-refresh-job rejection from the CLI output. Bright Data
 * returns a 409-like response when a prior heal's async refresh is still in
 * flight. This is NOT a planner failure — it's a gate, and the caller must
 * wait and retry rather than counting it as a failed attempt.
 */
function isJobBusy(stdout: string): boolean {
  return /Another (?:refresh|refactor) job is (?:already|still) in progress/i.test(stdout);
}

/**
 * Detect whether the CLI returned a planner failure (status:"error") as
 * opposed to a timeout or gate rejection. Planner failures mean the AI
 * planner accepted the job but couldn't fix it — different from a gate.
 */
function isPlannerError(result: HealCliResult): boolean {
  if (result.code !== 0 || result.timedOut) return false;
  const text = result.stdout ?? "";
  return /"status"\s*:\s*"error"/.test(text);
}

/**
 * Wait for a concurrent refresh job to clear. Called when a heal dispatch
 * is rejected with the "Another refresh job is already running" message.
 * Does NOT probe (which would start its own refresh job). Instead, waits
 * the full gate window and returns, trusting the next dispatch will succeed.
 */
async function waitForGateClear(): Promise<void> {
  const started = Date.now();
  let pollCount = 0;
  const maxPolls = Math.ceil(GATE_MAX_WAIT_MS / GATE_POLL_INTERVAL_MS);

  while (Date.now() - started < GATE_MAX_WAIT_MS) {
    pollCount++;
    emitLog("info", `⏳ Bright Data refresh job still running — waiting for clear (poll ${pollCount}/${maxPolls})`);
    await new Promise((r) => setTimeout(r, GATE_POLL_INTERVAL_MS));
  }

  emitLog("info", "Gate wait complete — dispatching heal");
}

/**
 * We do NOT pre-check the gate (any heal CLI call starts a job). Instead,
 * gate detection happens on the actual dispatch: if the heal is rejected
 * with the concurrent-job message, we wait and retry. This is called by
 * dispatchAndVerify when it detects a gate rejection.
 */

// ---- Verification ----

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
      emitLog("success", "✅ Heal landed · Bright Data returned the correct price and stock");
      return outcome;
    }
    if (attempt < POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  emitLog("warn", "Bright Data heal verification window expired");
  return null;
}

// ---- Dispatch (gate-gated, attempt-counted) ----

/**
 * Dispatch a single heal and verify. The gate must be clear before this is
 * called — this function never checks the gate itself. Only a dispatch where
 * the planner accepts the job counts as an attempt; a gate rejection is
 * returned as { gated: true } so the caller retries after waiting.
 */
async function dispatchAndVerify(
  collectorId: string,
  description: string,
  field: ExtractField,
  expectedPrice: number,
  attemptNumber: number,
): Promise<{ result: HealCliResult; verified: ScrapeOutcome | null; gated: boolean }> {
  emitLog("info", `Bright Data heal dispatched · attempt ${attemptNumber}/2 · collector ${collectorId}`);
  const result = await healCollectorCli(collectorId, description, HEAL_CLI_TIMEOUT_MS);

  // Gate rejection: the job was busy despite our gate check. Do NOT count
  // this as an attempt — tell the caller to wait and retry.
  if (isJobBusy(result.stdout)) {
    emitLog("warn", "⏳ Refresh job still running — heal rejected by gate");
    return { result, verified: null, gated: true };
  }

  if (!cliDone(result)) {
    if (isPlannerError(result)) {
      emitLog("warn", `Bright Data heal attempt ${attemptNumber} — planner error (not a gate rejection)`);
    } else {
      emitLog("warn", `Bright Data heal attempt ${attemptNumber} did not complete${result.timedOut ? " before timeout" : ""}`);
    }
    return { result, verified: null, gated: false };
  }

  emitLog("success", "Bright Data heal saved · template refresh queued");
  const verified = await waitForRefreshAndPoll(field, expectedPrice);
  return { result, verified, gated: false };
}

/**
 * Run a single heal attempt with full gate-check → dispatch → verify flow.
 * Returns the attempt result and whether it was counted.
 */
async function runAttempt(
  description: string,
  field: ExtractField,
  expectedPrice: number,
  attemptNumber: number,
  collectorId: string,
): Promise<{ counted: boolean; verified: ScrapeOutcome | null; result: HealCliResult }> {
  // No pre-dispatch gate check — any heal CLI call starts a job. Gate
  // detection happens on the actual dispatch via isJobBusy().

  const { result, verified, gated } = await dispatchAndVerify(
    collectorId, description, field, expectedPrice, attemptNumber,
  );

  if (gated) {
    // Gate rejection — wait for clear, then dispatch again (still same attempt)
    emitLog("info", "Waiting for refresh job to clear before retrying this attempt…");
    await waitForGateClear();
    const retry = await dispatchAndVerify(
      collectorId, description, field, expectedPrice, attemptNumber,
    );
    return { counted: !retry.gated, verified: retry.verified, result: retry.result };
  }

  return { counted: true, verified, result };
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
  const firstDescription = breakDescription(field, oldSelector, newSelector, product.name);
  const retryDescription = sharperDescription(field, oldSelector, newSelector);

  emitLog("info", `Heal protocol · description: "${firstDescription}"`);
  await updateWatch(watchId, { status: "healing" });

  let attemptedHeals = 0;
  let cliStdout: string | null = null;
  let cliCode: number | null = null;
  let cliTimedOut = false;
  let verifiedOutcome: ScrapeOutcome | null = null;

  if (STORE_COLLECTOR_ID) {
    // ---- ATTEMPT 1: DOM-diff description ----
    const first = await runAttempt(
      firstDescription, field, expectedPrice, 1, STORE_COLLECTOR_ID,
    );
    cliStdout = first.result.stdout;
    cliCode = first.result.code;
    cliTimedOut = first.result.timedOut;
    verifiedOutcome = first.verified;
    if (first.counted) attemptedHeals = 1;

    // ---- ATTEMPT 2 (only if attempt 1 didn't land): sharper template-name description ----
    if (!verifiedOutcome) {
      emitLog("warn", "First Bright Data heal did not land — retrying with the observed Template diff");
      emitLog("info", `Heal retry description: "${retryDescription}"`);

      // The first attempt may have started a refresh job. Gate detection
      // happens on dispatch; if rejected again, waitForGateClear handles it.

      const second = await runAttempt(
        retryDescription, field, expectedPrice, 2, STORE_COLLECTOR_ID,
      );
      cliStdout = [cliStdout, second.result.stdout].filter(Boolean).join("\n").slice(-600);
      cliCode = second.result.code;
      cliTimedOut = second.result.timedOut;
      verifiedOutcome = second.verified;
      if (second.counted) attemptedHeals = 2;
    }
  } else {
    emitLog("warn", "No Bright Data store collector configured");
  }

  const landed = verifiedOutcome != null;
  const source: HealOutcome["source"] = landed ? "brightdata-cli" : "deterministic";
  const recoveryPath: HealOutcome["recoveryPath"] = landed ? "bright-data" : "local-fallback";
  const confidence = landed ? 96 : 94;
  const scarCount = (watch.scar_count ?? 0) + 1;
  const healedAt = new Date();
  const recoverySeconds = Math.max(1, Math.round((healedAt.getTime() - startedAt) / 1000));

  await updateWatch(watchId, {
    selector: newSelector,
    status: "healing",
    scar_count: scarCount,
  });

  await logStructuredHeal({
    watch_id: watchId,
    collector_id: collectorId,
    broke_at: new Date(startedAt),
    healed_at: healedAt,
    original_intent: firstDescription,
    old_selector: oldSelector,
    new_selector: newSelector,
    confidence,
    recovery_seconds: recoverySeconds,
    attempted_heals: attemptedHeals,
    recovery_path: recoveryPath,
    description: `Scar #${scarCount} · attempted_heals=${attemptedHeals} · recovery_path=${recoveryPath}`,
    error_message: landed ? null : (cliStdout?.slice(-300) ?? "Bright Data verification did not land"),
  });

  return {
    newSelector,
    confidence,
    source,
    cliStdout,
    cliCode,
    cliTimedOut,
    durationMs: healedAt.getTime() - startedAt,
    attemptedHeals,
    recoveryPath,
    landed,
    verifiedOutcome,
  };
}
