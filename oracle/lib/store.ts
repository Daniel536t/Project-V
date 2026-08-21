// STORE domain — the controllable e-commerce page SENSE watches.
//
// THE REALISM CONTRACT (non-negotiable):
//   - The price lives in the `products` table (PostgreSQL). One source of truth.
//   - The store panel fetches it from /api/products and subscribes to SSE.
//   - The scraper fetches the rendered HTML representation (/api/store/html)
//     and extracts the price via the active template's CSS selector.
//   - When the template changes, the old selector genuinely stops matching —
//     that is the "break" the demo hinges on.
//
// Three DOM templates (A/B/C) render the SAME product data but with different
// markup, so a selector learned against one template is stale against another.

import { getPool } from "./db";
import { emitLog, emitStore, type ProductState } from "./stream";

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
}

export const PRODUCT_ID = "sony-a7iv";

export interface TemplateDef {
  key: string;
  label: string;
  priceSelector: string;
  stockSelector: string;
}

// Selectors MUST differ across templates (the whole break/heal mechanic).
export const TEMPLATES: Record<string, TemplateDef> = {
  A: {
    key: "A",
    label: "Classic",
    priceSelector: ".product-container .price",
    stockSelector: ".product-container .stock",
  },
  B: {
    key: "B",
    label: "Modern",
    priceSelector: ".pricing-section [data-test='current-price']",
    stockSelector: ".pricing-section [data-test='availability']",
  },
  C: {
    key: "C",
    label: "Schema",
    priceSelector: ".display-price",
    stockSelector: ".availability-badge",
  },
};

export const TEMPLATE_ORDER = ["A", "B", "C"] as const;

export function nextTemplate(current: string): string {
  const i = TEMPLATE_ORDER.indexOf(current as (typeof TEMPLATE_ORDER)[number]);
  return TEMPLATE_ORDER[(i + 1) % TEMPLATE_ORDER.length];
}

export function toState(p: ProductRow): ProductState {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    in_stock: p.in_stock,
    template: p.template,
    bot_detection: p.bot_detection,
  };
}

export async function getProduct(): Promise<ProductRow> {
  const { rows } = await getPool().query<ProductRow>(
    `SELECT * FROM products WHERE id = $1`,
    [PRODUCT_ID],
  );
  if (!rows[0]) throw new Error(`Product ${PRODUCT_ID} not found`);
  return rows[0];
}

export async function updateProduct(
  patch: Partial<Pick<ProductRow, "price" | "in_stock" | "template" | "bot_detection">>,
): Promise<ProductRow> {
  const current = await getProduct();
  const next: ProductRow = {
    ...current,
    ...patch,
    price: patch.price != null ? Number(patch.price) : current.price,
  };

  await getPool().query(
    `UPDATE products
     SET price = $1, in_stock = $2, template = $3, bot_detection = $4
     WHERE id = $5`,
    [next.price, next.in_stock, next.template, next.bot_detection, next.id],
  );

  const state = toState(next);
  emitStore(state);

  if (patch.template && patch.template !== current.template) {
    emitLog(
      "warn",
      `Store redesigned → template ${patch.template} (${TEMPLATES[patch.template]?.label ?? "?"})`,
    );
  }
  if (patch.price != null && patch.price !== current.price) {
    emitLog("info", `Price changed → $${next.price}`);
  }
  if (patch.in_stock != null && patch.in_stock !== current.in_stock) {
    emitLog("info", `Stock → ${next.in_stock ? "in stock" : "out of stock"}`);
  }
  if (patch.bot_detection != null && patch.bot_detection !== current.bot_detection) {
    emitLog(patch.bot_detection ? "warn" : "info", `Bot detection ${patch.bot_detection ? "ON" : "OFF"}`);
  }

  return next;
}

/**
 * Server-rendered HTML representation of the store page. This is what the
 * scraper fetches (the same markup a human sees in the store panel). The price
 * and stock are embedded under the ACTIVE template's selectors only.
 */
export function renderStoreHtml(p: ProductRow): string {
  const price = `$${p.price}`;
  const stock = p.in_stock ? "In Stock" : "Out of Stock";

  const jsonLd =
    p.template === "C"
      ? `<script type="application/ld+json">${JSON.stringify({
          "@type": "Offer",
          price: String(p.price),
          priceCurrency: "USD",
          availability: p.in_stock ? "InStock" : "OutOfStock",
        })}</script>`
      : "";

  // Template A — "classic": .product-container > .price
  if (p.template === "A") {
    return `<html><body>
<div class="product-container">
  <h1 class="title">${p.name}</h1>
  <span class="price">${price}</span>
  <span class="stock">${stock}</span>
</div></body></html>`;
  }

  // Template B — "modern": .pricing-section > [data-test='current-price']
  if (p.template === "B") {
    return `<html><body>
<section class="pricing-section">
  <h1 class="name">${p.name}</h1>
  <span data-test="current-price">${price}</span>
  <span data-test="availability">${stock}</span>
</section></body></html>`;
  }

  // Template C — "schema": JSON-LD + .display-price
  return `<html><body>
${jsonLd}
<main class="pdp">
  <h1 class="heading">${p.name}</h1>
  <span class="display-price">${price}</span>
  <span class="availability-badge">${stock}</span>
</main></body></html>`;
}
