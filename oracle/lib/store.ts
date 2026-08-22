// STORE domain — the controllable e-commerce storefront SENSE watches.
//
// THE REALISM CONTRACT (non-negotiable):
//   - The active product's price lives in the `products` table (PostgreSQL).
//   - The store panel fetches state from /api/store/state and subscribes to SSE.
//   - The scraper fetches the rendered HTML representation (/api/store/html)
//     and extracts the active product's price via the template's CSS selector.
//   - When the template changes (A→B→C), the old selector genuinely stops
//     matching — that is the "break" the demo hinges on.
//
// The store renders a featured-product GRID. Only the ACTIVE product's card
// carries the template's semantic selectors (`.price`, `[data-test=...]`,
// `.display-price`), so the collector always extracts exactly what the user
// is watching. The other cards use plain, non-selector markup.
//
// Three DOM templates (A/B/C) render the SAME grid, but with different card
// semantics, so a selector learned against one template is stale against
// another.

import { getPool } from "./db";
import { emitLog, emitStore, type ProductState } from "./stream";
import {
  FEATURED_PRODUCTS,
  featuredById,
  HERO_IMAGES,
  type FeaturedProduct,
} from "./store-shared";
export { PRODUCT_ID, PRODUCT_IMAGES, PRODUCT_NAME } from "./store-shared";

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
  stock_level: number;
}

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
    stockSelector: ".product-container .stock-status",
  },
  B: {
    key: "B",
    label: "Modern",
    priceSelector: ".pricing-section [data-test='current-price']",
    stockSelector: ".availability-badge",
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
    stock_level: Number(p.stock_level ?? 3),
  };
}

// There is exactly one active product row.
export async function getProduct(): Promise<ProductRow> {
  const { rows } = await getPool().query<ProductRow>(
    `SELECT * FROM products ORDER BY id LIMIT 1`,
  );
  if (!rows[0]) throw new Error(`No active product — seed the products table`);
  return rows[0];
}

/** Point the store at a featured product (one row, rewritten). */
export async function selectProduct(id: string): Promise<ProductRow> {
  const meta = featuredById(id);
  if (!meta) throw new Error(`Unknown product: ${id}`);

  await getPool().query(`DELETE FROM products`);
  await getPool().query(
    `INSERT INTO products (id, name, price, in_stock, template, bot_detection, stock_level)
     VALUES ($1, $2, $3, true, 'A', false, 3)`,
    [meta.id, meta.name, meta.price],
  );

  const product = await getProduct();
  emitStore(toState(product));
  emitLog("info", `Store product selected → ${product.name} · $${Number(product.price)}`);
  return product;
}

export async function updateProduct(
  patch: Partial<Pick<ProductRow, "price" | "in_stock" | "template" | "bot_detection" | "stock_level">>,
): Promise<ProductRow> {
  const current = await getProduct();
  const next: ProductRow = {
    ...current,
    ...patch,
    price: patch.price != null ? Number(patch.price) : current.price,
    stock_level: patch.stock_level != null ? Math.max(0, Number(patch.stock_level)) : Number(current.stock_level ?? 3),
  };

  await getPool().query(
    `UPDATE products
     SET price = $1, in_stock = $2, template = $3, bot_detection = $4, stock_level = $5
     WHERE id = $6`,
    [next.price, next.in_stock, next.template, next.bot_detection, next.stock_level, next.id],
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

// ---------------------------------------------------------------------------
// Server-rendered store page — a white, Apple-style storefront GRID. This is
// what the scraper fetches (the same data the user sees in the store panel).
//
// WARNING: class tokens `price` / `stock-status` / `availability-badge` /
// `display-price` may appear ONLY on the active product's card (the one the
// collector extracts), never anywhere else. Use `.cost`, `.pname`, `.money`
// etc. for the other cards and structural wrappers.
// ---------------------------------------------------------------------------

const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;background:#fff;color:#1d1d1f;line-height:1.4}
a{color:#0066cc;text-decoration:none}
a:hover{text-decoration:underline}
.storenav{background:#fff;border-bottom:1px solid #e8e8ed;padding:11px 22px;display:flex;align-items:center;gap:26px;font-size:13px;color:#1d1d1f;white-space:nowrap}
.logo{font-size:17px;font-weight:600}
.navlink{color:#1d1d1f}
.navlink:hover{text-decoration:none;color:#0071e3}
.navright{margin-left:auto;display:flex;align-items:center;gap:18px;color:#1d1d1f}
.wrap{max-width:1200px;margin:0 auto;padding:12px 22px 40px}
.store-head{display:flex;align-items:baseline;justify-content:space-between}
.store-head h1{font-size:34px;font-weight:600;letter-spacing:-.5px}
.browse{font-size:13px;color:#6e6e73}
.hero{display:flex;background:#f5f5f7;border-radius:18px;margin-top:12px;min-height:280px;overflow:hidden}
.hero-copy{padding:44px 48px;align-self:center}
.hero-copy h2{font-size:42px;line-height:1.06;font-weight:600;letter-spacing:-.8px}
.hero-copy p{font-size:15px;color:#6e6e73;margin-top:14px;line-height:1.45}
.cta{display:inline-block;background:#0071e3;color:#fff;border-radius:999px;padding:11px 24px;font-size:15px;font-weight:500;margin-top:24px}
.hero-media{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:24px;padding:24px}
.hero-media img{object-fit:contain}
.hero-media .phone{width:180px;filter:drop-shadow(0 18px 22px rgba(0,0,0,.18))}
.hero-media .side{width:100px;opacity:.95}
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px}
.feature{background:#f5f5f7;border-radius:14px;padding:16px 12px;text-align:center}
.feature .ic{font-size:20px}
.feature b{display:block;font-size:13px;margin-top:8px}
.feature span{display:block;font-size:12px;color:#6e6e73}
.featured-head{display:flex;justify-content:space-between;align-items:baseline;margin-top:28px}
.featured-head h2{font-size:20px;font-weight:600}
.featured-head a{font-size:13px;color:#0071e3}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:12px}
.card{border:1px solid #e8e8ed;border-radius:16px;padding:12px;background:#fff}
.card-img{background:#f5f5f7;border-radius:14px;aspect-ratio:1/1.08;display:flex;align-items:center;justify-content:center;padding:16px;position:relative}
.card-img img{max-width:100%;max-height:100%;object-fit:contain}
.pname{font-size:13.5px;font-weight:600;margin-top:10px;line-height:1.25}
.cost{font-size:12.5px;color:#6e6e73;display:block;margin-top:2px}
.money{display:flex;align-items:baseline;gap:6px;margin-top:2px}
.now{color:#28c840;font-size:11px;font-weight:600}
.was{color:#86868b;text-decoration:line-through;font-size:12px}
.stock-status{display:block;font-size:10px;font-weight:600;color:#007a3d;margin-top:2px}
.stock-status.out{color:#c00}
.availability-badge{display:inline-block;font-size:10px;font-weight:600;color:#007a3d;margin-top:2px}
.availability-badge.out{color:#c00}
.watch-caption{display:block;font-size:10px;color:#007aff;margin-top:3px}
.swatches{display:flex;gap:6px;margin-top:6px}
.swatch{width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.1)}
.footer{background:#f5f5f7;color:#6e6e73;text-align:center;padding:15px;font-size:11.5px;border-top:1px solid #e8e8ed;margin-top:28px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.features{grid-template-columns:1fr 1fr}}
`;

function headerHtml(): string {
  const links = ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "Accessories", "Support"]
    .map((l) => `<a class="navlink" href="#">${l}</a>`)
    .join("");
  return `<header class="storenav"><span class="logo"></span>${links}<span class="navright"><span>⌕</span><span>▢</span></span></header>`;
}

function footerHtml(): string {
  return `<footer class="footer">aperture · Apple &amp; more · Free delivery · 30-day returns · © 2026</footer>`;
}

function heroHtml(): string {
  return `<section class="hero">
  <div class="hero-copy"><h2>New season.<br>Elevated.</h2><p>Explore the latest in tech,<br>style, and everyday essentials.</p><span class="cta">Shop Now</span></div>
  <div class="hero-media"><img class="side" src="${HERO_IMAGES.buds}" alt=""><img class="phone" src="${HERO_IMAGES.phone}" alt=""><img class="side" src="${HERO_IMAGES.watch}" alt=""></div>
</section>`;
}

function featuresHtml(): string {
  const items: [string, string, string][] = [
    ["🚚", "Free shipping", "On orders over $50"],
    ["↩️", "30-day returns", "Hassle-free returns"],
    ["🔒", "Secure payment", "100% secure checkout"],
    ["🎧", "Specialist support", "We're here to help"],
  ];
  return `<section class="features">${items
    .map(([ic, t, s]) => `<div class="feature"><div class="ic">${ic}</div><b>${t}</b><span>${s}</span></div>`)
    .join("")}</section>`;
}

function swatchesHtml(colors: string[]): string {
  if (!colors.length) return "";
  return `<div class="swatches">${colors
    .map((c) => `<span class="swatch" style="background:${c}"></span>`)
    .join("")}</div>`;
}

function cardImageHtml(image: string, alt: string): string {
  return `<div class="card-img"><img src="${image}" alt="${alt}"></div>`;
}

/** A non-active card — plain markup, no semantic selectors. */
function plainCardHtml(f: FeaturedProduct): string {
  return `<div class="card">
  ${cardImageHtml(f.image, f.name)}
  <h3 class="pname">${f.name}</h3>
  <span class="cost">$${f.price}</span>
  ${swatchesHtml(f.colors)}
</div>`;
}

/** The ACTIVE card — template-specific semantic selectors. */
function activeCardHtml(p: ProductRow, meta: FeaturedProduct, template: string): string {
  const priceNum = Number(p.price);
  const price = `$${priceNum.toFixed(2)}`;
  const original = `$${Number(meta.price).toFixed(2)}`;
  const changed = priceNum !== Number(meta.price);
  const stock = p.in_stock ? "In Stock" : "Out of Stock";
  const out = p.in_stock ? "" : " out";
  const nowLabel = changed ? `<span class="now">Now</span>` : "";
  const wasLabel = changed ? `<span class="was">${original}</span>` : "";
  const image = cardImageHtml(meta.image, meta.name);
  const swatches = swatchesHtml(meta.colors);
  const caption = `<span class="watch-caption">● Watching</span>`;

  if (template === "B") {
    return `<div class="pricing-section card">
  ${image}
  <h3 data-testid="product-name" class="pname">${meta.name}</h3>
  <div class="money">${nowLabel}<span data-test="current-price">${price}</span>${wasLabel}</div>
  <span class="availability-badge${out}">${stock}</span>
  ${caption}
  ${swatches}
</div>`;
  }

  if (template === "C") {
    const jsonLd = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: meta.name,
      offers: {
        "@type": "Offer",
        price: String(p.price),
        priceCurrency: "USD",
        availability: p.in_stock ? "InStock" : "OutOfStock",
      },
    })}</script>`;
    return `<div class="card">
  ${image}
  <h3 itemProp="name" class="pname">${meta.name}</h3>
  <div class="money">${nowLabel}<span class="display-price">${price}</span>${wasLabel}</div>
  <span class="availability-badge${out}">${stock}</span>
  ${caption}
  ${swatches}
  ${jsonLd}
</div>`;
  }

  // Template A — "Classic"
  return `<div class="product-container card">
  ${image}
  <h3 class="product-title pname">${meta.name}</h3>
  <div class="money">${nowLabel}<span class="price">${price}</span>${wasLabel}</div>
  <span class="stock-status${out}">${stock}</span>
  ${caption}
  ${swatches}
</div>`;
}

export function renderStoreHtml(p: ProductRow): string {
  const cards = FEATURED_PRODUCTS.map((f) =>
    f.id === p.id ? activeCardHtml(p, f, p.template) : plainCardHtml(f),
  ).join("\n");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>aperture — Store</title><style>${STYLE}</style></head><body>
${headerHtml()}
<main class="wrap">
  <div class="store-head"><h1>Store</h1><span class="browse">Browse all ▾</span></div>
  ${heroHtml()}
  ${featuresHtml()}
  <section class="featured">
    <div class="featured-head"><h2>Featured Products</h2><a href="#">See All</a></div>
    <div class="grid">${cards}</div>
  </section>
</main>
${footerHtml()}
</body></html>`;
}
