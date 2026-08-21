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
// deliberate, complete redesigns of a white, Apple-style store page, so a
// selector learned against one template is stale against another.
//
// NOTE on class names: the scraper's extractBySelector matches the LAST class
// token of a selector (word-boundary regex), so the tokens `price` / `stock`
// must appear on exactly ONE element per template — the real price/stock —
// and never on any other element (so keep "compare", "save", etc. token-free
// of "price"/"stock").

import { getPool } from "./db";
import { emitLog, emitStore, type ProductState } from "./stream";
import { PRODUCT_ID, PRODUCT_IMAGES } from "./store-shared";
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
    stock_level: Number(p.stock_level ?? 3),
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
// Server-rendered store page — a real, white, Apple-style product page. This
// is what the scraper fetches (the same markup a human sees in the store
// panel's product view). The price and stock live under the ACTIVE template's
// selectors only.
// ---------------------------------------------------------------------------

// Inline stylesheet. WARNING: never contain `data-test=` attribute selectors,
// and never put the class tokens `price` / `stock` / `display-price` /
// `availability-badge` on any element other than the real price/stock.
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
.crumb{font-size:12px;color:#6e6e73;padding:16px 24px 0}
.crumb b{color:#1d1d1f;font-weight:500}
.page{padding:14px 24px 40px}
.wrap{max-width:1060px;margin:0 auto}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;margin-top:14px}
.gallery{display:flex;gap:12px;align-items:flex-start}
.thumbs{display:flex;flex-direction:column;gap:9px}
.thumbs img{width:56px;height:56px;object-fit:cover;border:1px solid #e8e8ed;border-radius:10px;cursor:pointer}
.main-img{flex:1;background:#f5f5f7;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:18px;min-height:320px}
.main-img img{max-width:100%;max-height:360px;object-fit:contain}
.title{font-size:30px;font-weight:700;letter-spacing:-.5px;line-height:1.1}
.tagline{font-size:17px;color:#6e6e73;margin-top:4px}
.divider{border-bottom:1px solid #e8e8ed;margin:16px 0}
.money{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:8px 0}
.price{font-size:30px;font-weight:700;letter-spacing:-.4px}
.compare{font-size:15px;color:#6e6e73;text-decoration:line-through}
.save{color:#c00;font-size:14px;font-weight:600}
.stock{color:#007a3d;font-size:14px;font-weight:600;display:block;margin:4px 0}
.stock.out{color:#c00}
.urgency{color:#c00;font-size:12.5px;margin:5px 0 0;font-weight:600}
.urgency.ok{color:#007a3d}
.lbl{font-size:13px;font-weight:600;margin:14px 0 7px}
.colors{display:flex;gap:9px;align-items:center}
.color{width:24px;height:24px;border-radius:50%;border:1px solid #d2d2d7;cursor:pointer}
.color.on{box-shadow:0 0 0 2px #0071e3,0 0 0 4px #fff,0 0 0 5px #0071e3}
.storage{display:flex;gap:8px;flex-wrap:wrap}
.storage-btn{border:1px solid #d2d2d7;background:#fff;border-radius:10px;padding:8px 16px;font-size:13px;cursor:pointer;font-weight:500}
.storage-btn.on{border-color:#0071e3;box-shadow:inset 0 0 0 1px #0071e3;color:#0071e3}
.bullets{margin:8px 0 0 18px;font-size:13.5px;line-height:1.7}
.bullets li{margin-bottom:5px}
.cta{display:block;width:100%;text-align:center;border-radius:12px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px;border:1px solid transparent}
.cta-blue{background:#0071e3;color:#fff}
.cta-blue:hover{background:#0077ed}
.cta-ghost{background:#fff;color:#0071e3;border-color:#0071e3}
.cta-ghost:hover{background:#f5f5f7}
.delivery{background:#f5f5f7;border-radius:12px;padding:13px 15px;font-size:13px;color:#1d1d1f;margin-top:16px;line-height:1.6}
.delivery b{font-weight:600}
.specs{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:16px}
.spec{background:#f5f5f7;border-radius:10px;padding:11px 13px;font-size:12.5px}
.hero{background:#f5f5f7;display:flex;align-items:center;justify-content:center;padding:30px 20px}
.hero img{max-height:300px;max-width:100%;object-fit:contain}
.center{max-width:640px;margin:0 auto;padding:26px 20px 40px;text-align:center}
.amount{font-size:38px;font-weight:700;letter-spacing:-.6px}
.avail{color:#007a3d;font-size:14px;font-weight:600}
.pill{display:inline-block;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:600}
.pill-green{background:#e5f6ec;color:#007a3d}
.pill-red{background:#fdeaea;color:#c00}
.grid3{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) minmax(0,0.7fr);gap:28px;margin-top:14px}
.rail{border:1px solid #e8e8ed;border-radius:16px;padding:16px}
.rail h3{font-size:15px;margin-bottom:10px}
.mini{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #e8e8ed}
.mini:last-of-type{border-bottom:0}
.mini img{width:46px;height:46px;object-fit:cover;border-radius:8px;border:1px solid #e8e8ed}
.mini .n{font-size:12.5px;line-height:1.3;color:#1d1d1f}
.mini .p{font-size:12.5px;font-weight:600;margin-top:2px}
.soldby{font-size:12px;color:#6e6e73;margin-top:12px;line-height:1.7}
.soldby b{color:#1d1d1f}
.tabs{display:flex;gap:4px;margin-top:24px;border-bottom:2px solid #e8e8ed}
.tab{padding:10px 18px;font-size:13.5px;cursor:pointer;color:#6e6e73;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab.on{color:#1d1d1f;border-bottom-color:#0071e3;font-weight:600}
.panel{background:#fff;border-radius:0 0 16px 16px;padding:20px 24px;font-size:13.5px;line-height:1.7;color:#333}
.panel h4{margin:14px 0 5px;font-size:14px;color:#1d1d1f}
.panel ul{margin:6px 0 0 18px}
.panel ul li{margin-bottom:4px}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table td{border-bottom:1px solid #e8e8ed;padding:8px 10px}
.table td:first-child{color:#6e6e73;width:40%}
.reviews{background:#f5f5f7;border-radius:16px;padding:22px 24px;margin-top:24px}
.rgrid{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:26px}
.rsummary h2{font-size:17px;margin-bottom:10px}
.rscore{font-size:34px;font-weight:700}
.rstars{color:#e67c00;font-size:14px}
.rmeta{font-size:12px;color:#6e6e73;margin-top:3px}
.rbar{height:8px;border-radius:4px;background:#e0e0e5;overflow:hidden;flex:1}
.rfill{height:100%;background:#e67c00;border-radius:4px}
.rrow{display:flex;align-items:center;gap:9px;font-size:12px;color:#6e6e73;margin-top:6px}
.rcard{border-bottom:1px solid #e0e0e5;padding:13px 0}
.rcard:last-child{border-bottom:0}
.rhead{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap}
.rname{font-weight:600}
.rdate{font-size:11px;color:#6e6e73}
.badge-vp{background:#e5f6ec;color:#007a3d;font-size:10px;padding:2px 7px;border-radius:999px}
.rtext{font-size:13px;margin-top:7px;line-height:1.65}
.rvote{font-size:11px;color:#6e6e73;margin-top:5px}
.rquote{font-size:13.5px;font-style:italic;color:#333;margin-top:14px;padding:13px 15px;background:#fff;border-radius:10px}
.footer{background:#f5f5f7;color:#6e6e73;text-align:center;padding:15px;font-size:11.5px;margin-top:26px;border-top:1px solid #e8e8ed}
@media(max-width:900px){.grid2,.grid3,.rgrid{grid-template-columns:1fr}.storenav{gap:16px;overflow:hidden}}
`;

function headerHtml(): string {
  const links = ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "Accessories", "Support"]
    .map((l) => `<a class="navlink" href="#">${l}</a>`)
    .join("");
  return `
<header class="storenav">
  <span class="logo"></span>
  ${links}
  <span class="navright"><span>⌕</span><span>▢</span></span>
</header>`;
}

function footerHtml(): string {
  return `<footer class="footer">aperture · Apple &amp; more · Free delivery · 30-day returns · © 2026</footer>`;
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

function urgencyHtml(p: ProductRow): string {
  if (!p.in_stock) return `<div class="urgency">Currently unavailable.</div>`;
  const level = Number(p.stock_level ?? 3);
  return level <= 5
    ? `<div class="urgency">Only ${level} left in stock — order soon.</div>`
    : `<div class="urgency ok">In stock — ready to ship.</div>`;
}

function colorsHtml(): string {
  return `<div class="lbl">Finish</div>
<div class="colors">
  <span class="color on" style="background:#b8b2a6" title="Natural Titanium"></span>
  <span class="color" style="background:#3a4a63" title="Blue Titanium"></span>
  <span class="color" style="background:#d9d4c9" title="White Titanium"></span>
  <span class="color" style="background:#2c2c2e" title="Black Titanium"></span>
</div>`;
}

function storageHtml(): string {
  return `<div class="lbl">Storage</div>
<div class="storage">
  <span class="storage-btn on">128GB</span>
  <span class="storage-btn">256GB</span>
  <span class="storage-btn">512GB</span>
  <span class="storage-btn">1TB</span>
</div>`;
}

function reviewsHtml(compact: boolean): string {
  if (compact) {
    return `<div class="reviews"><p class="rquote">★★★★★ &ldquo;Had SENSE watch this page for me — got the alert, ordered instantly.&rdquo; — Priya S. · Verified purchase</p></div>`;
  }
  const breakdown = [
    [5, 82],
    [4, 12],
    [3, 3],
    [2, 1],
    [1, 2],
  ]
    .map(
      ([s, pct]) =>
        `<div class="rrow"><span>${s}★</span><div class="rbar"><div class="rfill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`,
    )
    .join("");
  const cards = `
    <div class="rcard">
      <div class="rhead"><span class="rname">Marcus T.</span><span class="rstars">★★★★★</span><span class="rdate">Reviewed Aug 14, 2026</span><span class="badge-vp">✓ Verified purchase</span></div>
      <p class="rtext">Titanium feels incredible and the camera is a huge step up. Battery easily lasts me all day.</p>
      <div class="rvote">312 people found this helpful</div>
    </div>
    <div class="rcard">
      <div class="rhead"><span class="rname">Priya S.</span><span class="rstars">★★★★★</span><span class="rdate">Reviewed Aug 6, 2026</span><span class="badge-vp">✓ Verified purchase</span></div>
      <p class="rtext">Had SENSE watching the page for a price drop — it pinged me the second it went below my target. Zero stress.</p>
      <div class="rvote">204 people found this helpful</div>
    </div>
    <div class="rcard">
      <div class="rhead"><span class="rname">Danny R.</span><span class="rstars">★★★★☆</span><span class="rdate">Reviewed Jul 29, 2026</span><span class="badge-vp">✓ Verified purchase</span></div>
      <p class="rtext">USB-C finally. Action button is a nice touch. Gave it four stars only because the box arrived a bit scuffed.</p>
      <div class="rvote">118 people found this helpful</div>
    </div>`;
  return `<section class="reviews">
  <div class="rgrid">
    <div class="rsummary">
      <h2>Ratings &amp; Reviews</h2>
      <div class="rscore">4.9</div>
      <div class="rstars">★★★★★</div>
      <div class="rmeta">2,431 global ratings</div>
      <div style="margin-top:10px">${breakdown}</div>
    </div>
    <div>${cards}</div>
  </div>
</section>`;
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

  // ---- Template A — "Classic": Apple store 2-column (gallery + buy box) ----
  if (p.template === "A") {
    return `${head(p.name)}
${headerHtml()}
<div class="crumb">Store › iPhone › <b>${p.name}</b></div>
<main class="page wrap">
  <div class="grid2">
    ${galleryHtml()}
    <div class="product-container">
      <h1 class="title">${p.name}</h1>
      <p class="tagline">Titanium. So strong. So light. Pro.</p>
      <div class="divider"></div>
      <div class="money"><span class="price">${price}</span><span class="compare">${compare}</span><span class="save">Save ${savePct}%</span></div>
      <span class="stock${p.in_stock ? "" : " out"}">${stock}</span>
      ${urgencyHtml(p)}
      ${colorsHtml()}
      ${storageHtml()}
      <ul class="bullets">
        <li>A17 Pro chip with a 6-core GPU for console-class gaming.</li>
        <li>Aerospace-grade titanium — lightest Pro model ever.</li>
        <li>48MP Pro camera system with up to 3x telephoto.</li>
        <li>USB-C connector and all-day battery life.</li>
      </ul>
      <button class="cta cta-blue">Add to Bag</button>
      <button class="cta cta-ghost">Buy</button>
      <div class="delivery"><b>Free delivery</b> — in stock.<br>Ships within 24 hours · 30-day returns.</div>
    </div>
  </div>
  ${reviewsHtml(false)}
</main>
${footerHtml()}
</body></html>`;
  }

  // ---- Template B — "Modern": full-bleed hero image + centered buy box ----
  if (p.template === "B") {
    return `${head(p.name)}
${headerHtml()}
<div class="hero"><img src="${PRODUCT_IMAGES.main}" alt="${PRODUCT_IMAGES.alt}"></div>
<main class="center pricing-section">
  <h1 class="title">${p.name}</h1>
  <p class="tagline">Titanium. So strong. So light. Pro.</p>
  <div class="money" style="justify-content:center;margin-top:16px">
    <span data-test="current-price" class="amount">${price}</span>
    <span class="compare">${compare}</span>
    <span class="save">Save ${savePct}%</span>
  </div>
  <div style="margin-top:6px"><span data-test="availability" class="avail" style="${p.in_stock ? "" : "color:#c00"}">${stock}</span></div>
  ${urgencyHtml(p)}
  <div style="display:flex;justify-content:center;flex-wrap:wrap">${colorsHtml()}${storageHtml()}</div>
  <div class="specs">
    <div class="spec">A17 Pro chip</div><div class="spec">Titanium design</div><div class="spec">48MP camera</div><div class="spec">USB-C</div>
  </div>
  <button class="cta cta-blue">Add to Bag</button>
  <button class="cta cta-ghost">Buy</button>
  <p class="tagline" style="margin-top:12px">Free delivery · 30-day returns · 1-year warranty</p>
  ${reviewsHtml(true)}
</main>
${footerHtml()}
</body></html>`;
  }

  // ---- Template C — "Schema": 3-column + rail + tabs + JSON-LD ----
  return `${head(p.name)}
${jsonLd}
${headerHtml()}
<div class="crumb">Store › iPhone › <b>${p.name}</b></div>
<main class="page wrap">
  <div class="grid3">
    ${galleryHtml()}
    <div class="buybox">
      <h1 class="title">${p.name}</h1>
      <p class="tagline">Titanium. So strong. So light. Pro.</p>
      <div class="divider"></div>
      <div class="money"><span class="display-price">${price}</span><span class="compare">${compare}</span><span class="save">Save ${savePct}%</span></div>
      <div style="margin:6px 0"><span class="availability-badge pill ${p.in_stock ? "pill-green" : "pill-red"}">${stock}</span></div>
      ${urgencyHtml(p)}
      <ul class="bullets">
        <li>The most advanced Pro iPhone ever — titanium, A17 Pro, USB-C.</li>
        <li>48MP Pro camera with ProRAW and 4K ProRes.</li>
        <li>Action button, Dynamic Island, all-day battery.</li>
      </ul>
      ${colorsHtml()}
      ${storageHtml()}
      <button class="cta cta-blue">Add to Bag</button>
      <button class="cta cta-ghost">Buy</button>
    </div>
    <aside class="rail">
      <h3>Why iPhone</h3>
      <div class="mini"><img src="${PRODUCT_IMAGES.gallery[1]}" alt="trade-in"><div><div class="n">Apple Trade In</div><div class="p">Save up to $630</div></div></div>
      <div class="mini"><img src="${PRODUCT_IMAGES.gallery[3]}" alt="applecare"><div><div class="n">AppleCare+</div><div class="p">From $9.99/mo.</div></div></div>
      <div class="soldby"><b>Sold by</b> <a href="#">aperture</a> · 100% positive feedback<br>Free returns · 30 days<br>In stock — ships within 24 hours</div>
    </aside>
  </div>
  <div class="tabs"><span class="tab on">Overview</span><span class="tab">Tech Specs</span><span class="tab">Shipping &amp; Returns</span></div>
  <div class="panel">
    <h4>Overview</h4>
    <ul>
      <li>Titanium design — the lightest, strongest Pro iPhone ever.</li>
      <li>A17 Pro chip brings console-class gaming to a phone.</li>
      <li>48MP Pro camera system with up to 3x optical zoom.</li>
      <li>USB-C, Action button, and all-day battery life.</li>
    </ul>
    <h4>Tech Specs</h4>
    <table class="table">
      <tr><td>Display</td><td>6.1" Super Retina XDR · ProMotion</td></tr>
      <tr><td>Chip</td><td>A17 Pro</td></tr>
      <tr><td>Camera</td><td>48MP main · 3x telephoto · 12MP ultrawide</td></tr>
      <tr><td>Connector</td><td>USB-C</td></tr>
      <tr><td>Battery</td><td>Up to 29 hours video playback</td></tr>
    </table>
    <h4>Shipping &amp; Returns</h4>
    <ul>
      <li>Free delivery, in stock.</li>
      <li>30-day hassle-free returns.</li>
      <li>1-year warranty included.</li>
    </ul>
  </div>
  ${reviewsHtml(false)}
</main>
${footerHtml()}
</body></html>`;
}
