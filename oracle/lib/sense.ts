// SENSE core domain logic — the real scrape → break → heal → alert loop.
//
// The watch targets the store's rendered HTML (see lib/store.ts + lib/scraper.ts).
// A "scrape" genuinely extracts the value via the watch's CSS selector. When the
// store redesigns (template A→B→C), the selector stops matching → the scrape
// returns null → we detect the break, re-derive the selector from the original
// intent (the same thing Bright Data's heal does), log a scar, and re-scrape.

import {
  getWatch,
  getWatches,
  updateWatch,
  createWatch,
  logScrape,
  deleteWatchesBySource,
  type WatchRow,
} from "./db";
import { getProduct, selectProduct, TEMPLATES } from "./store";
import { detectProductId } from "./store-shared";
import { scrapeStore, scrapeLocalRecovery, parsePrice, STORE_PUBLIC_URL, type ExtractField, type ScrapeOutcome } from "./scraper";
import { emitAlert, emitLog } from "./stream";
import { healWatch, STORE_COLLECTOR_ID } from "./heal";
import {
  HN_COLLECTOR_ID,
  HN_NAME,
  LIVE_SCRAPE_INTERVAL_MS,
  scrapeLiveWatch,
} from "./live";

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

// In-memory lock — prevents overlapping scrape passes on the same watch
// (scheduler tick + admin force-scrape race). Per-process; fine for pm2.
const activePasses = new Map<string, Promise<RunResult>>();
// Only warn once per active pass — a heal's refresh-wait (~2 min) would
// otherwise spam "skipped" on every scheduler tick.
const skipWarned = new Set<string>();

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
  source?: "store" | "live";
}): Promise<WatchRow> {
  const source: "store" | "live" = input.source ?? "store";

  // LIVE watch: a real Bright Data collector against a real public URL. The
  // store watch is independent — each source keeps at most one active watch
  // (the demo tells one story per world, side by side).
  if (source === "live") {
    await deleteWatchesBySource("live");
    const collectorId = HN_COLLECTOR_ID;
    const watch = await createWatch({
      id: generateWatchId(),
      label: input.label,
      url: input.url,
      intent: input.intent,
      field: input.field,
      operator: input.operator,
      target: input.target,
      selector: null,
      query: input.query ?? null,
      status: "watching",
      collector_id: collectorId,
      product_name: HN_NAME,
      source: "live",
      next_check_at: new Date(),
    });
    emitLog(
      "info",
      `Live watch ${watch.id} created · collector ${collectorId} · ${input.url}`,
    );
    return watch;
  }

  // If the intent names a different product than the one the store currently
  // shows, switch the store first so the scraper targets the right page.
  const requestedId = input.query ? detectProductId(input.query) : null;
  const activeBefore = await getProduct();
  if (requestedId && requestedId !== activeBefore.id) {
    await selectProduct(requestedId);
  }

  const product = await getProduct();
  const t = TEMPLATES[product.template] ?? TEMPLATES.A;
  const field: ExtractField = input.field === "stock" ? "stock" : "price";
  const selector = field === "price" ? t.priceSelector : t.stockSelector;

  // One active STORE watch at a time (the store targets one product at a time).
  await deleteWatchesBySource("store");

  // Use the real Bright Data store collector when configured, so the watch's
  // c_ ID is the production collector (same ID across heals — the whole point).
  const collectorId = STORE_COLLECTOR_ID ?? generateCollectorId();

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
    collector_id: collectorId,
    product_name: product.name,
    source: "store",
    next_check_at: new Date(),
  });

  emitLog(
    "info",
    `Watch ${watch.id} created · collector ${watch.collector_id} · targeting ${product.name}`,
  );
  return watch;
}

/** Run one scrape on a LIVE watch (real Bright Data collector, real URL). */
async function runLiveScrapePass(watch: WatchRow): Promise<RunResult> {
  const events: string[] = [];
  const collectorId = watch.collector_id ?? HN_COLLECTOR_ID;

  emitLog("info", `Scraping ${watch.product_name ?? watch.url} (live)…`);
  await updateWatch(watch.id, { status: "checking" });

  const started = Date.now();
  const outcome = await scrapeLiveWatch(watch);
  const elapsedS = Math.round((Date.now() - started) / 1000);

  if (outcome.broke) {
    // Transient failures (slow batch, CLI hiccup, empty extraction on a
    // fast cycle) are not real breaks — keep watching and retry on the
    // next scheduled tick.
    if (outcome.reason === "collector-error" || outcome.reason === "empty-extraction") {
      emitLog(
        "warn",
        `Live scrape didn't return data (${outcome.reason ?? "transient"}) — retrying in ${Math.round(LIVE_SCRAPE_INTERVAL_MS / 1000)}s (collector ${collectorId})`,
      );
      await updateWatch(watch.id, {
        status: "watching",
        last_checked_at: new Date(),
        next_check_at: new Date(Date.now() + LIVE_SCRAPE_INTERVAL_MS),
      });
      return { watch: (await getWatch(watch.id))!, events, alerted: false, healed: false, value: null };
    }
    emitLog(
      "error",
      `Live scrape failed — ${outcome.reason ?? "empty"} (collector ${collectorId})`,
    );
    await updateWatch(watch.id, {
      status: "broken",
      last_value: null,
      last_checked_at: new Date(),
    });
    return { watch: (await getWatch(watch.id))!, events, alerted: false, healed: false, value: null };
  }

  const value = outcome.value;
  const alerted = evaluateCondition(value, watch.field, watch.operator, watch.target);

  await logScrape(watch.id, value != null ? Number(value) : null, null, {
    stories: outcome.stories,
    matched: outcome.matchedTitles,
  });

  const status = alerted ? "alerted" : "watching";
  await updateWatch(watch.id, {
    status,
    last_value: value,
    last_checked_at: new Date(),
    next_check_at: new Date(Date.now() + LIVE_SCRAPE_INTERVAL_MS),
  });

  emitLog(
    "success",
    `${outcome.stories.length} stories · top ${watch.query ?? ""} match rank=${value ?? "none"} · ${elapsedS}s (collector ${collectorId})`,
  );

  if (alerted) {
    const detail = outcome.matchedTitles[0] ?? null;
    emitLog(
      "alert",
      `CONDITION MET · "${watch.query ?? ""}" in top ${watch.target ?? "?"} · rank ${value}`,
    );
    emitAlert({
      watch_id: watch.id,
      product_name: watch.product_name ?? HN_NAME,
      value: value ?? "",
      field: watch.field,
      operator: watch.operator,
      target: watch.target,
      detail,
    });
    events.push("alert");
  }

  return { watch: (await getWatch(watch.id))!, events, alerted, healed: false, value };
}

/** Run one scrape on a watch, auto-healing if it breaks. */
export async function runScrapePass(watchId: string): Promise<RunResult> {
  // Serialize passes per watch — prevents the scheduler tick and admin
  // force-scrape from racing (both firing a heal and getting 409).
  const existing = activePasses.get(watchId);
  if (existing) {
    if (!skipWarned.has(watchId)) {
      skipWarned.add(watchId);
      emitLog("warn", `Scrape on ${watchId} skipped — already in progress`);
    }
    return existing;
  }
  const pass = runScrapePassInner(watchId);
  activePasses.set(watchId, pass);
  try {
    return await pass;
  } finally {
    activePasses.delete(watchId);
    skipWarned.delete(watchId);
  }
}

async function runScrapePassInner(watchId: string): Promise<RunResult> {
  let watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);

  // LIVE watch: real collector against a real URL — no store heal, no selector.
  if (watch.source === "live") {
    return runLiveScrapePass(watch);
  }

  const events: string[] = [];
  let healed = false;
  let alerted = false;
  let value: string | null = null;

  const field: ExtractField = watch.field === "stock" ? "stock" : "price";
  const product = await getProduct();
  const collectorId = watch.collector_id ?? "c_unknown";

  emitLog("info", `Scraping ${product.name} · ${STORE_PUBLIC_URL}…`);
  await updateWatch(watchId, { status: "checking" });

  let outcome = await scrapeStore(field);

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

    // Real heal: Bright Data CLI when configured, deterministic otherwise.
    const heal = await healWatch(watchId);
    healed = true;
    events.push("heal");

    // ---- honest post-heal refresh-wait + polling ----
    // save_new_template triggers an async refresh job on Bright Data's side.
    // An immediate re-scrape hits the old broken template. We wait for the
    // refresh to land, then poll the collector. The terminal narrates every
    // step honestly — real healing takes a minute.
    if (heal.source === "brightdata-cli") {
      emitLog("info", "Heal saved · template refreshing — polling collector…");
      // Wait 60s for the refresh job to propagate.
      await new Promise((r) => setTimeout(r, 60_000));

      let refreshed = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        emitLog("info", `Polling after heal (attempt ${attempt}/4)…`);
        const poll = await scrapeStore(field);
        if (!poll.broke && poll.price != null && poll.price > 0) {
          outcome = poll;
          refreshed = true;
          break;
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, 20_000));
      }

      if (refreshed) {
        emitLog("success", `Collector refresh complete · extraction restored via Bright Data heal`);
      } else {
        // If the collector heal didn't restore extraction after the full
        // refresh window, recover locally with the deterministic selector.
        // The terminal labels this "local recovery" honestly.
        emitLog("warn", `Collector heal did not restore extraction after refresh — recovering locally with selector ${heal.newSelector}`);
        outcome = await scrapeLocalRecovery(field, heal.newSelector);
      }
    } else {
      // Deterministic heal: re-scrape immediately (no Bright Data refresh to wait for).
      emitLog("info", "Re-running…");
      outcome = await scrapeStore(field);

      // If the collector still returns 0, recover locally.
      if (outcome.broke && heal.newSelector) {
        emitLog("warn", `Heal did not restore extraction — recovering locally with selector ${heal.newSelector}`);
        outcome = await scrapeLocalRecovery(field, heal.newSelector);
      }
    }

    if (!outcome.broke) {
      emitLog(
        "success",
        `Scar #${watch.scar_count} · healed in ${Math.max(1, Math.round(heal.durationMs / 1000))}s · zero downtime downstream`,
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
    `200 OK · price=${price ?? "?"} · stock=${inStock == null ? "?" : inStock} · via ${(outcome as ScrapeOutcome).source}`,
  );

  if (alerted) {
    emitLog("alert", `CONDITION MET · ${outcome.value} ${watch.operator} ${watch.target ?? ""} → alert dispatched`);
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

/** Force a scrape of every watch regardless of due-ness. The demo admin
 * controls call this so a redesign → break → heal (or a price change → alert)
 * happens live instead of waiting for the scheduler tick. */
export async function scrapeAllWatches(): Promise<RunResult[]> {
  // Admin store controls drive the STORE watch; the live watch runs on its own
  // slower cadence and must not be force-scraped by every store tweak.
  const watches = (await getWatches()).filter((w) => w.source === "store");
  const results: RunResult[] = [];
  for (const w of watches) {
    if (w.status === "checking" || w.status === "healing") continue; // avoid overlapping passes
    try {
      results.push(await runScrapePass(w.id));
    } catch (e) {
      emitLog("error", `Watch ${w.id} scrape error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return results;
}
