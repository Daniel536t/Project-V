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
import { getProduct, selectProduct, TEMPLATES, renderStoreHtml } from "./store";
import { detectProductId } from "./store-shared";
import { scrapeStore, scrapeLocalRecovery, parsePrice, storeScrapeUrl, type ExtractField, type ScrapeOutcome } from "./scraper";
import { extractBySelector } from "./local-extractor";
import { emitAlert, emitLog, emitHeal } from "./stream";
import { healWatch, STORE_COLLECTOR_ID } from "./heal";
import {
  HN_COLLECTOR_ID,
  HN_NAME,
  LIVE_SCRAPE_INTERVAL_MS,
  scrapeLiveWatch,
} from "./live";
import { runCollectorCli } from "./brightdata";

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
  previous?: string | null,
): boolean {
  if (field === "stock") {
    const inStock = /in stock/i.test(value ?? "");
    if (operator === "out_of_stock") return !inStock;
    return inStock;
  }
  // Content watches — "tell me when the page changes". The value is the
  // page's headline snapshot; a change only counts when it differs from the
  // previous reading (the first reading arms the watch, it doesn't alert).
  if (field === "content") {
    return operator === "changed" && previous != null && value !== previous;
  }
  const n = parsePrice(value);
  if (n == null) return false;
  // "Any change" — real diff semantics, not always-true: fires when the
  // value differs from the previous scrape, re-arms when it stabilizes.
  if (operator === "changed") return previous != null && value !== previous;
  // Magnitude-based: spike (≥10% increase between scrapes), drop (≥10% decrease)
  if (operator === "spike" || operator === "drop") {
    const prev = parsePrice(previous ?? null);
    if (prev != null && prev > 0) {
      const pct = (n - prev) / prev;
      if (operator === "spike") return pct >= 0.10;
      if (operator === "drop") return pct <= -0.10;
    }
    return false;
  }
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
  /** A live alert was dispatched this pass (false→true edge, not suppressed). */
  alerted: boolean;
  /** Raw condition evaluation this pass — true even when the alert was suppressed. */
  conditionMet: boolean;
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
  source?: "store" | "live" | "external";
}): Promise<WatchRow> {
  const source: "store" | "live" | "external" = input.source ?? "store";

  // EXTERNAL watch: any URL the user types. Create a fresh Bright Data
  // collector on the fly via CLI, save the ID — one collector per URL, never
  // recreated. Same scrape→break→heal→alert loop as everything else.
  //
  // Collector creation takes 60-120s (npx download + AI generation) so we
  // create the watch row FIRST with status "pending", return immediately,
  // and spawn the CLI in the background. The terminal streams progress.
  if (source === "external") {
    const url = input.url;
    if (!url || !url.startsWith("http")) {
      throw new Error("External watch requires a valid URL");
    }
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const label = input.label || `${domain} · ${input.field === "stock" ? "stock" : "price"}`;

    // DEDUP: if a watch already exists for this exact URL, reuse it instead of
    // spawning a second collector for the same page. Multiple watchers on one
    // URL was causing back-to-back `bdata scraper create` runs that timed out.
    const existing = (await getWatches()).find(
      (w) => w.source === "external" && w.url === url,
    );
    if (existing) {
      emitLog(
        "info",
        `Already watching ${domain} (${existing.id}) — reusing collector ${existing.collector_id ?? "(creating)"}`,
      );
      return existing;
    }

    // Create placeholder watch immediately so the chat doesn't hang.
    const watch = await createWatch({
      id: generateWatchId(),
      label,
      url,
      intent: input.intent ?? `Extract: product name, ${input.field}`,
      field: input.field,
      operator: input.operator,
      target: input.target,
      selector: null,
      query: input.query ?? domain,
      status: "pending",
      collector_id: null,
      product_name: input.label ?? domain,
      source: "external",
      next_check_at: new Date(),
    });

    // Detach collector creation — do NOT await. Fires in the background,
    // streams progress to the terminal, and updates the watch row when done.
    spawnExternalCollector(watch.id, url, domain, input.field).catch((err) => {
      emitLog("error", `External collector background task crashed: ${err}`);
    });

    return watch;
  }

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

/**
 * Background task: create a Bright Data collector via CLI for an external URL.
 * Runs detached from the HTTP request so the chat doesn't hang for 60-120s.
 * Streams progress to the terminal and updates the watch row on completion.
 */
async function spawnExternalCollector(
  watchId: string,
  url: string,
  domain: string,
  field: string,
): Promise<void> {
  emitLog("info", `Creating collector for ${domain}…`);
  const { spawn } = await import("node:child_process");

  try {
    const collectorId = await new Promise<string>((resolve, reject) => {
      const child = spawn("npx", [
        "-y", "-p", "@brightdata/cli", "bdata",
        "scraper", "create", url,
        `Extract: product name, ${field === "stock" ? "stock status" : "price as a number"}`,
        "--json",
      ], {
        env: { ...process.env, BRIGHTDATA_API_KEY: process.env.BRIGHT_DATA_API_KEY ?? "" },
      });
      let stdout = "";
      let stderr = "";
      let lastLine = "";
      child.stdout.on("data", (d: Buffer) => {
        const chunk = d.toString();
        stdout += chunk;
        // Stream polling progress to the terminal (one line per second max)
        const lines = chunk.split("\n").filter(Boolean);
        const latest = lines[lines.length - 1];
        if (latest && latest !== lastLine && /polling|attempt|Step/i.test(latest)) {
          lastLine = latest;
          emitLog("info", `  ${domain} · ${latest.trim()}`);
        }
      });
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        emitLog("error", `Collector creation timed out after 300s for ${domain}`);
        reject(new Error(`bdata scraper create timed out`));
      }, 300_000);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const errSnippet = (stderr || stdout).slice(-200).replace(/\n/g, " ");
          emitLog("error", `${domain}: collector creation failed (exit ${code}): ${errSnippet}`);
          reject(new Error(`bdata scraper create exited ${code}: ${errSnippet}`));
          return;
        }
        try {
          const cleaned = stdout.replace(/^[^{]*/, "").replace(/[^}]*$/, "}");
          const obj = JSON.parse(cleaned);
          const id = obj.collector_id || obj.id;
          if (id) { resolve(String(id)); return; }
        } catch {}
        const m = stdout.match(/(c_[a-z0-9]{12,20})/);
        if (m) { resolve(m[1]); return; }
        reject(new Error(`Could not parse collector ID from create output`));
      });
    });

    emitLog("success", `Collector ${collectorId} created · ${domain}`);
    await updateWatch(watchId, {
      collector_id: collectorId,
      status: "watching",
    });
    emitLog("info", `External watch ${watchId} now active · ${collectorId} · ${url}`);

    // Fire the first scrape async.
    void runScrapePass(watchId);
  } catch (err) {
    emitLog("error", `${domain}: collector creation failed — ${err instanceof Error ? err.message : String(err)}`);
    await updateWatch(watchId, {
      status: "broken",
    }).catch(() => {});
  }
}

/** Run one scrape on a LIVE watch (real Bright Data collector, real URL). */
async function runLiveScrapePass(
  watch: WatchRow,
  opts: ScrapeOptions = {},
): Promise<RunResult> {
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
      return { watch: (await getWatch(watch.id))!, events, alerted: false, conditionMet: false, healed: false, value: null };
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
    return { watch: (await getWatch(watch.id))!, events, alerted: false, conditionMet: false, healed: false, value: null };
  }

  const value = outcome.value;
  // EDGE-TRIGGERED: alert only on a false→true transition. last_condition_met
  // persists the previous evaluation, so a condition that stays met never
  // repeats; when it clears, the next true re-arms the alert.
  const met = evaluateCondition(value, watch.field, watch.operator, watch.target);
  const alerted = met && !(watch.last_condition_met ?? false) && !opts.suppressAlert;

  await logScrape(watch.id, value != null ? Number(value) : null, null, {
    stories: outcome.stories,
    matched: outcome.matchedTitles,
  });

  const status = alerted ? "alerted" : "watching";
  await updateWatch(watch.id, {
    status,
    last_value: value,
    last_condition_met: met,
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
      via: "brightdata-collector",
      elapsed_s: elapsedS,
    });
    events.push("alert");
  }

  return { watch: (await getWatch(watch.id))!, events, alerted, conditionMet: met, healed: false, value };
}

/** Run one scrape on an EXTERNAL watch (arbitrary URL, fresh collector). */
async function runExternalScrapePass(
  watch: WatchRow,
  opts: ScrapeOptions = {},
): Promise<RunResult> {
  const events: string[] = [];
  const url = watch.url;

  // Collector not ready yet (still being created in the background). Don't
  // spam the terminal with a scrape against a null collector ID — just skip
  // this tick and let the scheduler retry after creation completes.
  if (!watch.collector_id) {
    await updateWatch(watch.id, {
      next_check_at: new Date(Date.now() + LIVE_SCRAPE_INTERVAL_MS),
    }).catch(() => {});
    return { watch, events, alerted: false, conditionMet: false, healed: false, value: null };
  }
  const collectorId = watch.collector_id;

  emitLog("info", `Scraping ${watch.product_name ?? url} (external)…`);
  await updateWatch(watch.id, { status: "checking" });

  const started = Date.now();
  const raw = await runCollectorCli(collectorId, url, 240_000);
  const elapsedS = Math.round((Date.now() - started) / 1000);

  if (raw == null) {
    emitLog("warn", `External scrape returned no data (collector ${collectorId}) — retrying next tick`);
    await updateWatch(watch.id, {
      status: "watching",
      last_checked_at: new Date(),
      next_check_at: new Date(Date.now() + LIVE_SCRAPE_INTERVAL_MS),
    });
    return { watch: (await getWatch(watch.id))!, events, alerted: false, conditionMet: false, healed: false, value: null };
  }

  // Normalize the Bright Data envelope — same logic as scrapeStore
  const data = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  let price: number | null = null;
  let inStock: boolean | null = null;
  let productName: string | null = null;

  if (typeof data.price === "object" && data.price != null) {
    const po = data.price as Record<string, unknown>;
    price = typeof po.value === "number" ? po.value : parsePrice(String(po.value ?? "0"));
  } else if (typeof data.price === "number") {
    price = data.price;
  } else if (data.price != null) {
    price = parsePrice(String(data.price));
  }

  if (typeof data.in_stock === "boolean") inStock = data.in_stock;
  else if (data.in_stock != null) inStock = String(data.in_stock).toLowerCase() === "true";

  productName = String(data.product_name ?? data.name ?? data.title ?? watch.product_name ?? url);

  // Determine value based on field — content watches read the page headline.
  const value = watch.field === "content"
    ? productName
    : watch.field === "stock"
      ? (inStock === true ? "In Stock" : inStock === false ? "Out of Stock" : null)
      : price != null ? `$${price.toFixed(2)}` : null;

  // EDGE-TRIGGERED
  const met = evaluateCondition(value, watch.field, watch.operator, watch.target, watch.previous_value);
  const alerted = met && !(watch.last_condition_met ?? false) && !opts.suppressAlert;

  await logScrape(watch.id, price, inStock, { value, raw: data });

  const status = alerted ? "alerted" : "watching";
  await updateWatch(watch.id, {
    status,
    last_value: value,
    previous_value: watch.last_value,
    last_condition_met: met,
    last_checked_at: new Date(),
    next_check_at: new Date(Date.now() + LIVE_SCRAPE_INTERVAL_MS),
  });

  emitLog(
    "success",
    `200 OK · ${productName.slice(0, 50)} · ${value ?? "?"} · ${elapsedS}s (collector ${collectorId})`,
  );

  // Tell the chat the collector is ready — the agent shows "I'm building a scraper…"
  // and this follow-up confirms the result.
  emitAlert({
    kind: "watch_ready",
    watch_id: watch.id,
    product_name: productName,
    value: value ?? "",
    field: watch.field,
    operator: watch.operator,
    target: watch.target,
    collector_id: collectorId,
  });

  if (alerted) {
    emitLog("alert", `CONDITION MET · ${value} ${watch.operator} ${watch.target ?? ""} → alert dispatched`);
    emitAlert({
      watch_id: watch.id,
      product_name: productName,
      value: value ?? "",
      field: watch.field,
      operator: watch.operator,
      target: watch.target,
      previous: watch.previous_value ?? undefined,
      stock: inStock,
      via: "brightdata-collector",
      elapsed_s: elapsedS,
    });
    events.push("alert");
  }

  return { watch: (await getWatch(watch.id))!, events, alerted, conditionMet: met, healed: false, value };
}

/** Run one scrape on a watch, auto-healing if it breaks. */
export interface ScrapeOptions {
  /**
   * Suppress the alert emission for this pass (used for the creation-time
   * first scrape: if the condition is already met, the chat says so
   * conversationally instead of firing a repeating alert).
   */
  suppressAlert?: boolean;
}

export async function runScrapePass(
  watchId: string,
  opts: ScrapeOptions = {},
): Promise<RunResult> {
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
  const pass = runScrapePassInner(watchId, opts);
  activePasses.set(watchId, pass);
  try {
    return await pass;
  } finally {
    activePasses.delete(watchId);
    skipWarned.delete(watchId);
  }
}

async function runScrapePassInner(
  watchId: string,
  opts: ScrapeOptions = {},
): Promise<RunResult> {
  let watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);

  // LIVE / EXTERNAL watch: real collector against a real URL — no store heal, no selector.
  if (watch.source === "live") {
    return runLiveScrapePass(watch, opts);
  }
  if (watch.source === "external") {
    return runExternalScrapePass(watch, opts);
  }

  const events: string[] = [];
  let healed = false;
  let alerted = false;
  let conditionMet = false;
  let value: string | null = null;

  const field: ExtractField = watch.field === "stock" ? "stock" : "price";
  const product = await getProduct();
  const collectorId = watch.collector_id ?? "c_unknown";

  emitLog("info", `Scraping ${product.name} · ${storeScrapeUrl(product.id)}…`);
  await updateWatch(watchId, { status: "checking" });

  // First: try the watch's stored selector against the current store HTML.
  // If it returns null, the selector is stale (template changed) → break.
  // The real Bright Data collector path does this naturally; the local
  // fallback must simulate it with the watch's selector, not the template's.
  const watchSelector = watch.selector;
  let outcome: ScrapeOutcome;
  if (watchSelector) {
    const html = renderStoreHtml(product, product.id);
    const watchValue = extractBySelector(html, watchSelector);
    if (watchValue == null) {
      outcome = { broke: true, reason: "selector-stale", value: null, price: null, inStock: null, source: "local-fallback" };
    } else {
      // Selector still works — extract full data using template selectors
      const t = TEMPLATES[product.template] ?? TEMPLATES.A;
      const price = parsePrice(extractBySelector(html, t.priceSelector));
      const inStockRaw = extractBySelector(html, t.stockSelector);
      const inStock = inStockRaw ? /in stock/i.test(inStockRaw) : null;
      const value = field === "stock"
        ? (inStock === true ? "In Stock" : inStock === false ? "Out of Stock" : null)
        : `$${price?.toFixed(2) ?? "0.00"}`;
      outcome = { broke: false, value, price, inStock, source: "local-fallback" };
    }
  } else {
    outcome = await scrapeStore(field);
  }

  // ---- BREAK: bot detection ----
  if (outcome.broke && outcome.reason === "bot-detection") {
    emitLog("error", `403 Forbidden — bot detection active (collector ${collectorId})`);
    await updateWatch(watchId, { status: "broken", last_value: null });
    watch = (await getWatch(watchId))!;
    return { watch, events, alerted: false, conditionMet: false, healed: false, value: null };
  }

  // ---- BREAK: stale selector → auto-heal ----
  if (outcome.broke && outcome.reason === "selector-stale") {
    emitLog("warn", "!! Empty extraction — break detected");
    events.push("break");

    // Calculate old template info for the chat agent
    const oldSelector = watch.selector;
    const oldTemplateKey = (() => {
      for (const [k, t] of Object.entries(TEMPLATES)) {
        if (t.priceSelector === oldSelector || t.stockSelector === oldSelector) return k;
      }
      return null;
    })();

    // Tier-1 heal: deterministic selector recovery — instant (<100ms).
    // Bright Data verification runs in the background; does NOT block.
    const heal = await healWatch(watchId);
    healed = true;
    events.push("heal");

    // The heal already updated the watch's selector to match the current
    // template. Re-scrape immediately — it always succeeds because we
    // control the store DOM.
    outcome = await scrapeLocalRecovery(field, heal.newSelector);

    // Re-read for updated scar_count.
    watch = (await getWatch(watchId))!;

    const newTemplate = TEMPLATES[product.template] ?? TEMPLATES.A;

    // Tell the chat agent what happened
    emitHeal({
      watch_id: watchId,
      product_name: product.name,
      stage: "break",
      old_selector: oldSelector,
      new_selector: heal.newSelector,
      old_template: oldTemplateKey,
      new_template: product.template,
      scar_number: watch.scar_count,
      template_label: newTemplate.label,
    });

    emitHeal({
      watch_id: watchId,
      product_name: product.name,
      stage: "heal",
      old_selector: oldSelector,
      new_selector: heal.newSelector,
      old_template: oldTemplateKey,
      new_template: product.template,
      scar_number: watch.scar_count,
      template_label: newTemplate.label,
    });

    if (!outcome.broke && outcome.value != null) {
      const bdNote = STORE_COLLECTOR_ID ? " · Bright Data verifying in background" : "";
      emitLog("success", `Selector recovered · ${heal.newSelector} · 0 downtime${bdNote}`);
    }
  }

  // ---- still broken after heal → mark broken ----
  if (outcome.broke || outcome.value == null) {
    emitLog("error", `Scrape failed — ${outcome.reason ?? "empty"} (collector ${collectorId})`);
    await updateWatch(watchId, { status: "broken", last_value: null });
    watch = (await getWatch(watchId))!;
    return { watch, events, alerted: false, conditionMet: false, healed, value: null };
  }

  // ---- success: record history + evaluate condition ----
  const price = outcome.price;
  const inStock = outcome.inStock;
  await logScrape(watchId, price, inStock, { value: outcome.value, selector: watch.selector });

  // EDGE-TRIGGERED: alert only on a false→true transition. last_condition_met
  // persists the previous evaluation, so a condition that stays met never
  // repeats; when it clears, the next true re-arms the alert. The creation-time
  // first scrape suppresses emission — the chat says it conversationally.
  conditionMet = evaluateCondition(outcome.value, watch.field, watch.operator, watch.target, watch.previous_value);
  alerted = conditionMet && !(watch.last_condition_met ?? false) && !opts.suppressAlert;
  value = outcome.value;

  const status = alerted ? "alerted" : healed ? "healed" : "watching";
  await updateWatch(watchId, {
    status,
    last_value: outcome.value,
    previous_value: watch.last_value,
    last_condition_met: conditionMet,
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
      previous: watch.previous_value ?? undefined,
      stock: inStock,
      via: (outcome as ScrapeOutcome).source,
    });
    events.push("alert");
  }

  watch = (await getWatch(watchId))!;
  return { watch, events, alerted, conditionMet, healed, value };
}

// ---- scheduler hook ----

export async function scrapeDueWatches(): Promise<RunResult[]> {
  const watches = await getWatches();
  const now = Date.now();
  const results: RunResult[] = [];
  for (const w of watches) {
    const due = w.next_check_at == null || new Date(w.next_check_at).getTime() <= now;
    const idle = w.status !== "alerted" && w.status !== "checking" && w.status !== "broken" && w.status !== "pending";
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
