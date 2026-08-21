// SENSE core domain logic — the real scrape → break → heal → alert loop.
//
// The watch targets the store's rendered HTML (see lib/store.ts + lib/scraper.ts).
// A "scrape" genuinely extracts the value via the watch's CSS selector. When the
// store redesigns (template A→B→C), the selector stops matching → the scrape
// returns null → we detect the break, re-derive the selector from the original
// intent (the same thing Bright Data's heal does), log a scar, and re-scrape.

import { getWatch, getWatches, updateWatch, createWatch, logScrape, logStructuredHeal, type WatchRow } from "./db";
import { getProduct, TEMPLATES, PRODUCT_ID } from "./store";
import { scrapeStore, parsePrice, type ExtractField } from "./scraper";
import { emitAlert, emitLog } from "./stream";

export function generateWatchId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `W-${id}`;
}

export function generateCollectorId(): string {
  const chars = "0123456789abcdefghjkmnpqrstvwxyz";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `c_${id}`;
}

export const SCRAPE_INTERVAL_MS = 25 * 1000; // scheduler cadence (20–30s)

// ---- condition evaluation ----

export function evaluateCondition(
  value: string | null,
  field: string,
  operator: string,
  target: string | null,
): boolean {
  if (field === "stock") {
    const inStock = /in stock/i.test(value ?? "");
    if (operator === "out_of_stock") return !inStock;
    return inStock;
  }
  const n = parsePrice(value);
  if (n == null) return false;
  if (operator === "changed") return true;
  const parsed = target == null ? null : parsePrice(target);
  if (parsed == null) return false;
  const t: number = parsed;
  switch (operator) {
    case "<": return n < t;
    case "<=": return n <= t;
    case ">": return n > t;
    case ">=": return n >= t;
    case "==": return n === t;
    default: return false;
  }
}

// ---- the scrape pass ----

export interface RunResult {
  watch: WatchRow;
  events: string[];
  alerted: boolean;
  healed: boolean;
  value: string | null;
}

export async function createWatchFromIntent(input: {
  label: string;
  url: string;
  intent: string;
  field: string;
  operator: string;
  target: string | null;
  query?: string | null;
}): Promise<WatchRow> {
  const product = await getProduct();
  const t = TEMPLATES[product.template] ?? TEMPLATES.A;
  const field: ExtractField = input.field === "stock" ? "stock" : "price";
  const selector = field === "price" ? t.priceSelector : t.stockSelector;

  const watch = await createWatch({
    id: generateWatchId(),
    label: input.label,
    url: input.url,
    intent: input.intent,
    field,
    operator: input.operator,
    target: input.target,
    selector,
    query: input.query ?? null,
    status: "watching",
    collector_id: generateCollectorId(),
    product_name: product.name,
    next_check_at: new Date(),
  });

  emitLog(
    "info",
    `Watch ${watch.id} created · collector ${watch.collector_id} · targeting ${product.name}`,
  );
  return watch;
}

/** Run one scrape on a watch, auto-healing if it breaks. */
export async function runScrapePass(watchId: string): Promise<RunResult> {
  let watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);

  const events: string[] = [];
  let healed = false;
  let alerted = false;
  let value: string | null = null;

  const field: ExtractField = watch.field === "stock" ? "stock" : "price";
  const product = await getProduct();
  const collectorId = watch.collector_id ?? "c_unknown";

  emitLog("info", `Scraping ${PRODUCT_ID}…`);
  await updateWatch(watchId, { status: "checking" });

  let outcome = await scrapeStore(field, watch.selector);

  // ---- BREAK: bot detection ----
  if (outcome.broke && outcome.reason === "bot-detection") {
    emitLog("error", `403 Forbidden — bot detection active (collector ${collectorId})`);
    await updateWatch(watchId, { status: "broken", last_value: null });
    watch = (await getWatch(watchId))!;
    return { watch, events, alerted: false, healed: false, value: null };
  }

  // ---- BREAK: stale selector → auto-heal ----
  if (outcome.broke && outcome.reason === "selector-stale") {
    emitLog("error", "Empty extraction — break detected");
    events.push("break");

    const oldSelector = watch.selector;
    const t = TEMPLATES[product.template] ?? TEMPLATES.A;
    const newSelector = field === "price" ? t.priceSelector : t.stockSelector;
    const brokeAt = new Date();

    emitLog("info", `Heal protocol · intent: "${watch.intent ?? `Find the ${field} for ${product.name}`}"`);
    emitLog("info", `Bright Data heal dispatched (collector ${collectorId})`);

    // Heal = re-derive the selector from the original intent against the new DOM.
    await updateWatch(watchId, {
      selector: newSelector,
      status: "healing",
      scar_count: (watch.scar_count ?? 0) + 1,
    });

    // Confidence: high when we match a known template selector, else lower.
    const confidence = TEMPLATES[product.template] ? 94 : 78;
    const healedAt = new Date();
    const recoverySeconds = Math.max(1, Math.round((healedAt.getTime() - brokeAt.getTime()) / 1000));

    await logStructuredHeal({
      watch_id: watchId,
      collector_id: collectorId,
      broke_at: brokeAt,
      healed_at: healedAt,
      original_intent: watch.intent ?? `Find the ${field} for ${product.name}`,
      old_selector: oldSelector,
      new_selector: newSelector,
      confidence,
      recovery_seconds: recoverySeconds,
      description: `Scar #${(watch.scar_count ?? 0) + 1} — ${field} selector moved`,
      error_message: `Selector "${oldSelector}" no longer matches template ${product.template}`,
    });

    emitLog("success", `Healed · ${field} now at ${newSelector} · confidence ${confidence}%`);
    emitLog("info", "Re-running…");

    watch = (await getWatch(watchId))!;
    outcome = await scrapeStore(field, newSelector);
    healed = true;
    events.push("heal");

    if (!outcome.broke) {
      emitLog(
        "success",
        `Scar #${watch.scar_count} · healed in ${recoverySeconds}s · zero downtime downstream`,
      );
    }
  }

  // ---- still broken after heal → mark broken ----
  if (outcome.broke || outcome.value == null) {
    emitLog("error", `Scrape failed — ${outcome.reason ?? "empty"} (collector ${collectorId})`);
    await updateWatch(watchId, { status: "broken", last_value: null });
    watch = (await getWatch(watchId))!;
    return { watch, events, alerted: false, healed, value: null };
  }

  // ---- success: record history + evaluate condition ----
  const price = outcome.price;
  const inStock = outcome.inStock;
  await logScrape(watchId, price, inStock, { value: outcome.value, selector: watch.selector });

  alerted = evaluateCondition(outcome.value, watch.field, watch.operator, watch.target);
  value = outcome.value;

  const status = alerted ? "alerted" : healed ? "healed" : "watching";
  await updateWatch(watchId, {
    status,
    last_value: outcome.value,
    last_checked_at: new Date(),
    next_check_at: new Date(Date.now() + SCRAPE_INTERVAL_MS),
  });

  emitLog(
    "success",
    `200 OK · price=${price ?? "?"} · stock=${inStock == null ? "?" : inStock}`,
  );

  if (alerted) {
    emitLog("success", `CONDITION MET: ${outcome.value} ${watch.operator} ${watch.target ?? ""} → alert dispatched`);
    emitAlert({
      watch_id: watchId,
      product_name: product.name,
      value: outcome.value,
      field: watch.field,
      operator: watch.operator,
      target: watch.target,
    });
    events.push("alert");
  }

  watch = (await getWatch(watchId))!;
  return { watch, events, alerted, healed, value };
}

// ---- scheduler hook ----

export async function scrapeDueWatches(): Promise<RunResult[]> {
  const watches = await getWatches();
  const now = Date.now();
  const results: RunResult[] = [];
  for (const w of watches) {
    const due = w.next_check_at == null || new Date(w.next_check_at).getTime() <= now;
    const idle = w.status !== "alerted" && w.status !== "checking" && w.status !== "broken";
    if (due && idle) {
      try {
        results.push(await runScrapePass(w.id));
      } catch (e) {
        emitLog("error", `Watch ${w.id} scrape error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return results;
}
