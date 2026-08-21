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
// Three DOM templates (A/B/C) render the SAME product data but as three
// deliberate, complete redesigns of a white, Amazon-style store page, so a
// selector learned against one template is stale against another.
//
// NOTE on class names: the scraper's extractBySelector matches the LAST class
// token of a selector (word-boundary regex), so the tokens `price` / `stock`
// must appear on exactly ONE element per template — the real price/stock —
// and never inside the shared <style> block.

import { getPool } from "./db";
import { emitLog, emitStore, type ProductState } from "./stream";
export { PRODUCT_ID, PRODUCT_IMAGES, PRODUCT_NAME } from "./store-shared";
import { PRODUCT_ID, PRODUCT_IMAGES } from "./store-shared";

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
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

// ---------------------------------------------------------------------------
// Server-rendered store page — a real, white, Amazon-style shop. This is what
// the scraper fetches (the same markup a human sees in the store panel). The
// price and stock live under the ACTIVE template's selectors only.
// ---------------------------------------------------------------------------

// Inline stylesheet. WARNING: must never contain `data-test=` attribute
// selectors or class tokens `price`/`stock`/`display-price`/`availability-badge`
// — the scraper scans this string and would mis-extract.
const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#eaeded;color:#0f1111;line-height:1.45}
a{color:#007185;text-decoration:none}
.brand-bar{background:#131921;color:#fff;padding:9px 22px;display:flex;align-items:center;gap:16px}
.brand{font-size:21px;font-weight:700;letter-spacing:.5px;white-space:nowrap}
.brand b{color:#ff9900}
.searchbar{flex:1;display:flex;max-width:620px;border-radius:6px;overflow:hidden;border:2px solid #febd69;background:#fff}
.searchbar input{flex:1;border:0;padding:7px 12px;font-size:13px;outline:0;min-width:0}
.searchbar button{background:#febd69;border:0;padding:0 16px;font-weight:600;cursor:pointer;font-size:13px}
.nav{background:#232f3e;color:#fff;padding:6px 22px;font-size:12.5px;display:flex;gap:16px;flex-wrap:wrap}
.nav span{cursor:pointer}
.crumbs{font-size:12px;padding:12px 22px 0;color:#565959}
.page{padding:12px 22px 34px}
.grid2{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:26px;background:#fff;padding:22px;border-radius:10px;margin-top:14px}
.gallery{display:flex;gap:10px}
.thumbs{display:flex;flex-direction:column;gap:8px}
.thumbs img{width:48px;height:48px;object-fit:cover;border:1px solid #d5d9d9;border-radius:4px;cursor:pointer}
.main-img{flex:1;background:#fff;border:1px solid #e7e9ec;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:14px;min-height:280px}
.main-img img{max-width:100%;max-height:330px;object-fit:contain}
.title{font-size:21px;line-height:1.3;font-weight:400}
.stars{color:#e67c00;font-size:13px;margin:6px 0 2px}
.meta{font-size:12px;color:#565959;margin:6px 0}
.divider{border-bottom:1px solid #e7e9ec;margin:10px 0}
.money{display:flex;align-items:baseline;gap:8px;margin:8px 0;flex-wrap:wrap}
.price{font-size:26px;font-weight:600}
.compare{font-size:13px;color:#565959;text-decoration:line-through}
.save{color:#cc0c39;font-size:13px;font-weight:600}
.stock{color:#007600;font-size:14px;font-weight:600;display:block;margin:4px 0}
.stock.out{color:#b12704}
.bullets{margin:10px 0 0 18px;font-size:13px;line-height:1.7}
.bullets li{margin-bottom:4px}
.cta{width:100%;display:block;text-align:center;border-radius:20px;padding:9px;font-size:14px;font-weight:600;border:1px solid;cursor:pointer;margin-top:9px}
.cta-yellow{background:#ffd814;border-color:#fcd200}
.cta-yellow:hover{background:#f7ca00}
.cta-orange{background:#ffa41c;border-color:#ff8f00}
.cta-orange:hover{background:#fa8900}
.specs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}
.specs div{background:#f3f3f3;border:1px solid #e7e9ec;border-radius:8px;padding:9px 11px;font-size:12.5px}
.hero{background:#f5f5f5;display:flex;align-items:center;justify-content:center;padding:28px 20px}
.hero img{max-height:300px;max-width:100%;object-fit:contain}
.center{max-width:640px;margin:0 auto;padding:24px 20px 36px;text-align:center}
.tagline{color:#565959;font-size:14px;margin-top:4px}
.amount{font-size:34px;font-weight:700}
.avail{color:#007600;font-size:14px;font-weight:600}
.pill{display:inline-block;border-radius:999px;padding:5px 14px;font-size:13px;font-weight:600}
.pill-green{background:#e8f7ee;color:#067647}
.pill-red{background:#fdecec;color:#b12704}
.grid3{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr) minmax(0,3fr);gap:22px;background:#fff;padding:22px;border-radius:10px;margin-top:14px}
.rail{border:1px solid #e7e9ec;border-radius:10px;padding:14px}
.rail h3{font-size:14px;margin-bottom:8px}
.mini{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #e7e9ec}
.mini:last-of-type{border-bottom:0}
.mini img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #e7e9ec}
.mini .n{font-size:12px;line-height:1.3;color:#0f1111}
.mini .p{font-size:12px;font-weight:600;margin-top:2px}
.soldby{font-size:12px;color:#565959;margin-top:10px;line-height:1.7}
.soldby b{color:#0f1111}
.tabs{display:flex;gap:4px;margin-top:22px;border-bottom:2px solid #e7e9ec}
.tab{padding:9px 16px;font-size:13px;cursor:pointer;color:#565959;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab.on{color:#0f1111;border-bottom-color:#e67c00;font-weight:600}
.panel{background:#fff;border-radius:0 0 10px 10px;padding:18px 22px;font-size:13px;line-height:1.7;color:#333}
.panel h4{margin:12px 0 4px;font-size:13.5px;color:#0f1111}
.panel ul{margin:6px 0 0 18px}
.panel ul li{margin-bottom:3px}
.table{width:100%;border-collapse:collapse;font-size:12.5px}
.table td{border-bottom:1px solid #e7e9ec;padding:7px 10px}
.table td:first-child{color:#565959;width:38%}
.footer{background:#232f3e;color:#cdd;text-align:center;padding:13px;font-size:11.5px;margin-top:22px}
@media(max-width:900px){.grid2,.grid3{grid-template-columns:1fr}.searchbar{display:none}}
`;

function headerFull(): string {
  return `
<header class="brand-bar">
  <div class="brand">aperture<b>.</b></div>
  <div class="searchbar"><input placeholder="Search sneakers, apparel, accessories"><button>Search</button></div>
</header>
<nav class="nav"><span>All</span><span>Sneakers</span><span>Apparel</span><span>Accessories</span><span>Deals</span><span>Support</span></nav>`;
}

function headerMinimal(): string {
  return `
<header class="brand-bar" style="justify-content:space-between">
  <div class="brand">aperture<b>.</b></div>
  <nav class="nav" style="background:transparent;padding:0"><span>Shop</span><span>Sneakers</span><span>About</span></nav>
</header>`;
}

function footerHtml(): string {
  return `<footer class="footer">aperture · Shoes &amp; Streetwear · Free 2-day shipping over $50 · 30-day returns · © 2026</footer>`;
}

function galleryHtml(): string {
  const thumbs = PRODUCT_IMAGES.gallery
    .map((u) => `<img src="${u}" alt="${PRODUCT_IMAGES.alt}">`)
    .join("");
  return `<div class="gallery">
  <div class="thumbs">${thumbs}</div>
  <div class="main-img"><img src="${PRODUCT_IMAGES.main}" alt="${PRODUCT_IMAGES.alt}"></div>
</div>`;
}

export function renderStoreHtml(p: ProductRow): string {
  const priceNum = Number(p.price);
  const price = `$${priceNum.toFixed(2)}`;
  const stock = p.in_stock ? "In Stock" : "Out of Stock";
  const comparePrice = Math.max(priceNum + 1, Math.round(priceNum / 0.9));
  const savePct = Math.max(1, Math.round(((comparePrice - priceNum) / comparePrice) * 100));
  const compare = `$${comparePrice.toFixed(2)}`;

  const jsonLd =
    p.template === "C"
      ? `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          image: PRODUCT_IMAGES.main,
          offers: {
            "@type": "Offer",
            price: String(p.price),
            priceCurrency: "USD",
            availability: p.in_stock ? "InStock" : "OutOfStock",
          },
        })}</script>`
      : "";

  const head = (title: string) =>
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — aperture</title><style>${STYLE}</style></head><body>`;

  // ---- Template A — "Classic": classic Amazon product page, gallery + buy box ----
  if (p.template === "A") {
    return `${head(p.name)}
${headerFull()}
<div class="crumbs">Shoes › Men › Sneakers › <b>${p.name}</b></div>
<main class="page">
  <div class="grid2">
    ${galleryHtml()}
    <div class="product-container">
      <h1 class="title">${p.name}</h1>
      <div class="stars">★★★★★ <a href="#">4.8</a> · 1,247 ratings</div>
      <div class="meta">Ships from and sold by <a href="#">aperture</a>.</div>
      <div class="divider"></div>
      <div class="money"><span class="price">${price}</span><span class="compare">${compare}</span><span class="save">Save ${savePct}%</span></div>
      <span class="stock${p.in_stock ? "" : " out"}">${stock}</span>
      <ul class="bullets">
        <li>Classic &quot;Panda&quot; colorway — clean white leather with black Swoosh.</li>
        <li>Padded high-top collar with cushioned foam insole for all-day comfort.</li>
        <li>Perforated leather toe box keeps things breathable.</li>
        <li>Solid rubber cupsole with pivot-circle traction.</li>
        <li>Includes replacement laces, box and dust bag.</li>
      </ul>
      <button class="cta cta-yellow">Add to Cart</button>
      <button class="cta cta-orange">Buy Now</button>
    </div>
  </div>
</main>
${footerHtml()}
</body></html>`;
  }

  // ---- Template B — "Modern": minimal DTC layout, hero image + centered buy box ----
  if (p.template === "B") {
    return `${head(p.name)}
${headerMinimal()}
<div class="hero"><img src="${PRODUCT_IMAGES.main}" alt="${PRODUCT_IMAGES.alt}"></div>
<main class="center pricing-section">
  <div class="stars" style="justify-content:center">★★★★★ 4.8 · 1,247 ratings</div>
  <h1 class="title" style="font-size:26px">${p.name}</h1>
  <p class="tagline">Classic high-top · Leather upper · Panda colorway</p>
  <div class="money" style="justify-content:center;margin-top:14px">
    <span data-test="current-price" class="amount">${price}</span>
    <span class="compare">${compare}</span>
    <span class="save">Save ${savePct}%</span>
  </div>
  <div class="meta" style="margin-top:6px"><span data-test="availability" class="avail" style="${p.in_stock ? "" : "color:#b12704"}">${stock}</span></div>
  <div class="specs">
    <div>Leather upper</div><div>Black Swoosh</div><div>Rubber outsole</div><div>Padded collar</div>
  </div>
  <button class="cta cta-yellow">Add to Cart</button>
  <button class="cta cta-orange">Buy Now</button>
  <p class="meta" style="margin-top:10px">Free 2-day shipping · 30-day returns · 1-year warranty</p>
</main>
${footerHtml()}
</body></html>`;
  }

  // ---- Template C — "Schema": Amazon layout + right rail + tabs + JSON-LD ----
  return `${head(p.name)}
${jsonLd}
${headerFull()}
<div class="crumbs">Shoes › Men › Sneakers › <b>${p.name}</b></div>
<main class="page">
  <div class="grid3">
    ${galleryHtml()}
    <div class="buybox">
      <h1 class="title">${p.name}</h1>
      <div class="stars">★★★★★ <a href="#">4.8</a> · 1,247 ratings · 1,000+ bought in past month</div>
      <div class="divider"></div>
      <div class="money"><span class="display-price">${price}</span><span class="compare">${compare}</span><span class="save">Save ${savePct}%</span></div>
      <div class="meta" style="margin:6px 0"><span class="availability-badge pill ${p.in_stock ? "pill-green" : "pill-red"}">${stock}</span></div>
      <ul class="bullets">
        <li>The most-wanted colorway of the Dunk line — sells out in minutes.</li>
        <li>Genuine leather upper with perforated toe box.</li>
        <li>High-top silhouette with padded collar and cushioned insole.</li>
        <li>Solid rubber outsole with classic pivot-circle traction.</li>
      </ul>
      <button class="cta cta-yellow">Add to Cart</button>
      <button class="cta cta-orange">Buy Now</button>
    </div>
    <aside class="rail">
      <h3>Frequently bought together</h3>
      <div class="mini"><img src="${PRODUCT_IMAGES.gallery[2]}" alt="socks"><div><div class="n">Nike Elite Crew Socks (3-pack)</div><div class="p">$18.00</div></div></div>
      <div class="mini"><img src="${PRODUCT_IMAGES.gallery[1]}" alt="shields"><div><div class="n">Sneaker Shields Inserts (2-pack)</div><div class="p">$9.00</div></div></div>
      <button class="cta cta-yellow">Buy all 3 · $166.00</button>
      <div class="soldby"><b>Sold by</b> <a href="#">aperture</a> · 100% positive feedback<br>Free returns · 30 days<br>In stock — ships within 24 hours</div>
    </aside>
  </div>
  <div class="tabs"><span class="tab on">Description</span><span class="tab">Specifications</span><span class="tab">Shipping &amp; Returns</span></div>
  <div class="panel">
    <h4>About this item</h4>
    <ul>
      <li>The &quot;Panda&quot; Dunk — the colorway that turned a basketball icon into streetwear's most-wanted sneaker.</li>
      <li>Genuine leather upper with perforated toe box for breathability.</li>
      <li>High-top silhouette with padded collar, cushioned insole and pivot-circle traction.</li>
      <li>Fits true to size; runs narrow — size up half a size for wide feet.</li>
    </ul>
    <h4>Specifications</h4>
    <table class="table">
      <tr><td>Brand</td><td>Nike</td></tr>
      <tr><td>Style</td><td>DD1391-100</td></tr>
      <tr><td>Colorway</td><td>White / Black &quot;Panda&quot;</td></tr>
      <tr><td>Upper</td><td>Genuine leather</td></tr>
      <tr><td>Midsole</td><td>EVA foam</td></tr>
      <tr><td>Outsole</td><td>Solid rubber</td></tr>
      <tr><td>Fit</td><td>True to size</td></tr>
    </table>
    <h4>Shipping &amp; Returns</h4>
    <ul>
      <li>Free 2-day shipping on orders over $50.</li>
      <li>30-day hassle-free returns.</li>
      <li>1-year manufacturer warranty included.</li>
    </ul>
  </div>
</main>
${footerHtml()}
</body></html>`;
}
