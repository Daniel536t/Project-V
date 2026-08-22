// Scraper engine — invokes the real Bright Data store collector against the
// deployed public store URL. The terminal's "200 OK · price=…" line is now
// parsed from Bright Data's real envelope — not a local render + regex.
//
// When a template redesign breaks the collector's learned extraction rules,
// the price degrades to 0 (the collector's "could not find it" value). We
// detect that as a REAL break, heal the collector in place via bdata scraper
// heal, and re-run — same collector ID.
//
// If the heal doesn't restore extraction (the collector still returns 0 on the
// new template), we recover locally using the deterministic re-derived selector
// from heal.ts. The terminal labels this "local recovery" honestly — it's the
// same semantic action, just executed in-process when Bright Data's AI heal
// can't fix the concrete selectors.

import { runCollectorCli } from "./brightdata";
import { getProduct, renderStoreHtml, TEMPLATES } from "./store";
import { extractBySelector } from "./local-extractor";

export type ExtractField = "price" | "stock";

export interface ScrapeOutcome {
  broke: boolean;
  reason?: "selector-stale" | "bot-detection" | "collector-error";
  value: string | null;
  price: number | null;
  inStock: boolean | null;
  source: "brightdata-collector" | "local-fallback" | "local-recovery";
}

/** The deployed public URL the store collector scrapes (base, no params). */
export const STORE_PUBLIC_URL =
  process.env.STORE_PUBLIC_URL ?? "https://sense-rho.vercel.app/api/store/html";

/**
 * Product-scoped scrape URL. The collector must target ONE product's card so
 * "the price" is never ambiguous across the five-card grid.
 */
export function storeScrapeUrl(productId: string): string {
  const u = new URL(STORE_PUBLIC_URL);
  u.searchParams.set("product", productId);
  return u.toString();
}

export function parsePrice(value: string | null): number | null {
  if (value == null) return null;
  const m = value.replace(/[^0-9.]/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).toLowerCase().trim();
  if (s === "true" || s === "in stock" || s === "yes") return true;
  if (s === "false" || s === "out of stock" || s === "no") return false;
  return null;
}

function normalizeStoreEnvelope(raw: unknown): {
  price: number;
  inStock: boolean | null;
} | null {
  if (raw == null) return null;
  let obj: Record<string, unknown> | null = null;
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object") {
    obj = raw[0] as Record<string, unknown>;
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return null;
  let price = 0;
  if (typeof obj.price === "number") price = obj.price;
  else if (obj.price != null) price = parsePrice(String(obj.price)) ?? 0;
  const inStock = parseBool(obj.in_stock ?? obj.inStock);
  return { price, inStock };
}

/** Run the real Bright Data collector against the Vercel URL. */
export async function scrapeStore(field: ExtractField): Promise<ScrapeOutcome> {
  const product = await getProduct();

  if (product.bot_detection) {
    return {
      broke: true, reason: "bot-detection",
      value: null, price: null, inStock: null,
      source: "brightdata-collector",
    };
  }

  const collectorId = process.env.BRIGHT_DATA_STORE_COLLECTOR_ID ?? null;

  if (!collectorId) {
    // No collector → local fallback, clearly labelled.
    const t = TEMPLATES[product.template] ?? TEMPLATES.A;
    const selector = field === "price" ? t.priceSelector : t.stockSelector;
    return scrapeLocal(field, selector, product, "local-fallback");
  }

  const raw = await runCollectorCli(collectorId, storeScrapeUrl(product.id), 240_000);
  if (raw == null) {
    return {
      broke: true, reason: "collector-error",
      value: null, price: null, inStock: null,
      source: "brightdata-collector",
    };
  }

  const env = normalizeStoreEnvelope(raw);
  const price = env?.price ?? null;
  const inStock = env?.inStock ?? null;

  if (price == null || price <= 0) {
    return {
      broke: true, reason: "selector-stale",
      value: null, price: null, inStock: null,
      source: "brightdata-collector",
    };
  }

  const value = field === "stock"
    ? (inStock === true ? "In Stock" : inStock === false ? "Out of Stock" : null)
    : `$${price.toFixed(2)}`;

  return { broke: false, value, price, inStock, source: "brightdata-collector" };
}

/**
 * Local recovery scrape. Called after the real collector broke and the heal
 * didn't restore extraction. Uses the deterministic re-derived selector from
 * heal.ts against the local DOM — same semantic action, honestly labelled.
 */
export async function scrapeLocalRecovery(
  field: ExtractField,
  selector: string,
): Promise<ScrapeOutcome> {
  const product = await getProduct();
  return scrapeLocal(field, selector, product, "local-recovery");
}

function scrapeLocal(
  field: ExtractField,
  selector: string,
  product: import("./store").ProductRow,
  source: "local-fallback" | "local-recovery",
): ScrapeOutcome {
  const html = renderStoreHtml(product, product.id);
  const value = extractBySelector(html, selector);
  if (value == null) {
    return {
      broke: true, reason: "selector-stale",
      value: null, price: null, inStock: null,
      source,
    };
  }
  const t = TEMPLATES[product.template] ?? TEMPLATES.A;
  const price = parsePrice(extractBySelector(html, t.priceSelector));
  const inStockRaw = extractBySelector(html, t.stockSelector);
  const inStock = inStockRaw ? /in stock/i.test(inStockRaw) : null;
  return { broke: false, value, price, inStock, source };
}