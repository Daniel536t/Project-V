// SENSE heal orchestration.
//
// Bright Data is the primary recovery path. A CLI `done` response is not
// treated as success by itself because save_new_template refreshes the
// collector asynchronously. We verify the collector against the live,
// product-scoped store page before declaring that the heal landed.

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

function templateForSelector(selector: string | null): string {
  if (selector === TEMPLATES.A.priceSelector || selector === TEMPLATES.A.stockSelector) return "A";
  if (selector === TEMPLATES.B.priceSelector || selector === TEMPLATES.B.stockSelector) return "B";
  if (selector === TEMPLATES.C.priceSelector || selector === TEMPLATES.C.stockSelector) return "C";
  return "the previous template";
}

/**
 * The first prompt is generated from the observed selector diff. It contains
 * the semantic diagnosis Bright Data needs, not just the original intent.
 */
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

function cliDone(result: HealCliResult): boolean {
  if (result.code !== 0 || result.timedOut) return false;
  const text = result.stdout ?? "";
  return /"status"\s*:\s*"done"/.test(text) && /save_new_template/.test(text);
}

function expectedValueIsValid(
  outcome: ScrapeOutcome,
  expectedPrice: number,
): boolean {
  // A valid Bright Data envelope must contain both fields. The price check
  // prevents a stale/incorrect product result from being called a heal.
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

async function dispatchAndVerify(
  collectorId: string,
  description: string,
  field: ExtractField,
  expectedPrice: number,
  attempt: number,
): Promise<{ result: HealCliResult; verified: ScrapeOutcome | null }> {
  emitLog("info", `Bright Data heal dispatched · attempt ${attempt}/2 · collector ${collectorId}`);
  const result = await healCollectorCli(collectorId, description, HEAL_CLI_TIMEOUT_MS);
  if (!cliDone(result)) {
    emitLog(
      "warn",
      `Bright Data heal attempt ${attempt} did not complete${result.timedOut ? " before timeout" : ""}`,
    );
    return { result, verified: null };
  }

  emitLog("success", "Bright Data heal saved · template refresh queued");
  const verified = await waitForRefreshAndPoll(field, expectedPrice);
  return { result, verified };
}

/**
 * Run the real two-attempt heal. The returned `landed` flag is based on a
 * successful post-refresh Bright Data envelope, never merely CLI status.
 */
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
    attemptedHeals = 1;
    try {
      const first = await dispatchAndVerify(
        STORE_COLLECTOR_ID,
        firstDescription,
        field,
        expectedPrice,
        1,
      );
      cliStdout = first.result.stdout;
      cliCode = first.result.code;
      cliTimedOut = first.result.timedOut;
      verifiedOutcome = first.verified;

      if (!verifiedOutcome) {
        attemptedHeals = 2;
        emitLog("warn", "First Bright Data heal did not land — retrying with the observed Template diff");
        emitLog("info", `Heal retry description: "${retryDescription}"`);
        const second = await dispatchAndVerify(
          STORE_COLLECTOR_ID,
          retryDescription,
          field,
          expectedPrice,
          2,
        );
        cliStdout = [cliStdout, second.result.stdout].filter(Boolean).join("\n").slice(-600);
        cliCode = second.result.code;
        cliTimedOut = second.result.timedOut;
        verifiedOutcome = second.verified;
      }
    } catch (error) {
      emitLog(
        "warn",
        `Bright Data heal request failed · ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attemptedHeals < 2) attemptedHeals = 2;
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
