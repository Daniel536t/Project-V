// Scraper engine — fetches the store's rendered HTML and extracts the value
// for a given CSS selector. This mirrors what a Bright Data collector does:
// given a selector, read the matching element's text. When the template changes
// and the selector no longer exists in the markup, extraction returns null —
// that null is the "break" signal.

import { getProduct, renderStoreHtml, TEMPLATES } from "./store";

export type ExtractField = "price" | "stock";

export interface ScrapeOutcome {
  broke: boolean;
  reason?: "selector-stale" | "bot-detection";
  value: string | null;
  price: number | null;
  inStock: boolean | null;
}

/**
 * Extract the text content of the first element matching `selector` from an
 * HTML string. Supports the two selector shapes our templates use:
 *   - `.a .b`  (descendant class chains)
 *   - `[data-test='x']`
 * This is intentionally a real HTML scan (not a lookup table), so it genuinely
 * returns null when the selector is absent from the markup.
 */
export function extractBySelector(html: string, selector: string): string | null {
  if (!selector) return null;

  // Attribute selector: [data-test='current-price']
  const attr = selector.match(/\[([a-zA-Z-]+)='([^']+)'\]/);
  if (attr) {
    const [, name, value] = attr;
    const re = new RegExp(`${name}=['"]${escapeRegExp(value)}['"][^>]*>([^<]*)<`, "i");
    const m = html.match(re);
    return m ? decodeHtml(m[1].trim()) : null;
  }

  // Class selector: possibly chained (.product-container .price).
  const classes = selector.split(/\s+/).filter((c) => c.startsWith("."));
  if (classes.length === 0) return null;
  const last = classes[classes.length - 1].slice(1);
  const re = new RegExp(`class=['"][^'"]*\\b${escapeRegExp(last)}\\b[^'"]*['"][^>]*>([^<]*)<`, "i");
  const m = html.match(re);
  return m ? decodeHtml(m[1].trim()) : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parsePrice(value: string | null): number | null {
  if (value == null) return null;
  const m = value.replace(/[^0-9.]/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parseStock(value: string | null): boolean | null {
  if (value == null) return null;
  return /in stock/i.test(value);
}

/**
 * Scrape the store for a watch's field using the watch's CURRENT selector.
 * If the selector doesn't match the active template → broke (selector-stale).
 * If bot detection is ON → broke (bot-detection), mirroring a 403 challenge.
 */
export async function scrapeStore(
  field: ExtractField,
  selector: string | null,
): Promise<ScrapeOutcome> {
  const product = await getProduct();
  const t = TEMPLATES[product.template] ?? TEMPLATES.A;

  if (product.bot_detection) {
    return {
      broke: true,
      reason: "bot-detection",
      value: null,
      price: null,
      inStock: null,
    };
  }

  const html = renderStoreHtml(product);
  const value = extractBySelector(html, selector ?? "");

  if (value == null) {
    return {
      broke: true,
      reason: "selector-stale",
      value: null,
      price: null,
      inStock: null,
    };
  }

  const price = parsePrice(extractBySelector(html, t.priceSelector));
  const inStock = parseStock(extractBySelector(html, t.stockSelector));

  return { broke: false, value, price, inStock };
}


