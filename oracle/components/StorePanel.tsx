"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PRODUCT_IMAGES, PRODUCT_NAME } from "@/lib/store-shared";

interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
}

const ALL_IMAGES = [PRODUCT_IMAGES.main, ...PRODUCT_IMAGES.gallery];

const BULLETS = [
  "Classic \"Panda\" colorway — clean white leather with black Swoosh.",
  "Padded high-top collar with cushioned foam insole for all-day comfort.",
  "Perforated leather toe box keeps things breathable.",
  "Solid rubber cupsole with pivot-circle traction.",
  "Includes replacement laces, box and dust bag.",
];

export default function StorePanel({ onOpenBreak }: { onOpenBreak: () => void }) {
  const [product, setProduct] = useState<ProductState | null>(null);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/products/nike-dunk-panda");
      setProduct(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const es = new EventSource("/api/store/stream");
    es.onmessage = (e) => {
      try {
        setProduct(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [load]);

  if (!product) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="flex items-center gap-3 font-mono text-sm text-[#565959]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#131921] border-t-transparent" />
          Loading store…
        </div>
      </div>
    );
  }

  const addToCart = () => {
    if (!product.in_stock) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const shared = {
    price: `$${Number(product.price).toFixed(2)}`,
    compare: `$${Math.max(product.price + 1, Math.round(Number(product.price) / 0.9)).toFixed(2)}`,
    savePct: Math.max(
      1,
      Math.round(
        ((Math.max(product.price + 1, Math.round(Number(product.price) / 0.9)) - Number(product.price)) /
          Math.max(product.price + 1, Math.round(Number(product.price) / 0.9))) *
          100,
      ),
    ),
    stockLabel: product.in_stock ? "In Stock" : "Out of Stock",
    inStock: product.in_stock,
    onAdd: addToCart,
    added,
  };

  return (
    <div className="relative flex h-full flex-col bg-white text-[#0f1111]">
      {/* ── Amazon-style header ── */}
      <StoreHeader />

      {/* ── Scrollable product area (bottom padding clears the terminal strip) ── */}
      <div className="sense-scroll relative min-h-0 flex-1 overflow-y-auto pb-14">
        <AnimatePresence mode="wait">
          {product.template === "A" && <TemplateA key="A" {...shared} />}
          {product.template === "B" && <TemplateB key="B" {...shared} />}
          {product.template === "C" && <TemplateC key="C" {...shared} />}
        </AnimatePresence>
        <StoreFooter />
      </div>

      {/* ── Floating Break button ── */}
      <div className="pointer-events-none absolute bottom-16 right-6 z-20">
        <button
          onClick={onOpenBreak}
          className="sense-press pointer-events-auto flex items-center gap-2 rounded-xl border border-[#ff2d55]/60 bg-[#131921]/95 px-4 py-2.5 font-mono text-[12px] font-medium text-white shadow-[0_8px_30px_-10px_rgba(19,25,33,0.7)] backdrop-blur transition hover:border-[#ff2d55] hover:bg-[#131921]"
        >
          ⚙ Break This Site
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared store chrome
 * ------------------------------------------------------------------ */

function StoreHeader() {
  return (
    <header className="shrink-0">
      <div className="flex items-center gap-3 bg-[#131921] px-4 py-2 text-white">
        <span className="whitespace-nowrap text-[19px] font-bold tracking-wide">
          aperture<span className="text-[#ff9900]">.</span>
        </span>
        <div className="hidden min-w-0 flex-1 items-center overflow-hidden rounded-md border-2 border-[#febd69] bg-white md:flex">
          <input
            readOnly
            placeholder="Search sneakers, apparel, accessories"
            className="min-w-0 flex-1 px-3 py-1.5 text-[13px] text-[#0f1111] outline-none"
          />
          <span className="flex cursor-pointer items-center bg-[#febd69] px-4 text-[13px] font-semibold text-[#0f1111]">
            Search
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-[12px] text-white/90">
          <span className="hidden cursor-pointer hover:underline sm:block">Sign in</span>
          <span className="flex cursor-pointer items-center gap-1 hover:underline">
            <span className="text-[15px]">🛒</span>
            <span className="hidden sm:inline">Cart</span>
          </span>
        </div>
      </div>
      <nav className="flex flex-wrap gap-4 bg-[#232f3e] px-4 py-1.5 text-[12px] text-white/90">
        {["All", "Sneakers", "Apparel", "Accessories", "Deals"].map((l) => (
          <span key={l} className="cursor-pointer hover:text-white hover:underline">
            {l}
          </span>
        ))}
      </nav>
    </header>
  );
}

function StoreFooter() {
  return (
    <footer className="mt-6 bg-[#232f3e] px-4 py-3 text-center text-[11px] text-[#ccd5dd]">
      aperture · Shoes &amp; Streetwear · Free 2-day shipping over $50 · 30-day returns · © 2026
    </footer>
  );
}

function Breadcrumbs({ name }: { name: string }) {
  return (
    <div className="text-[12px] text-[#565959]">
      Shoes › Men › Sneakers ›{" "}
      <span className="font-medium text-[#0f1111]">{name}</span>
    </div>
  );
}

function Stars({ centered }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-[13px] ${centered ? "justify-center" : ""}`}>
      <span className="tracking-tight text-[#e67c00]">★★★★★</span>
      <a className="text-[#007185] hover:underline">4.8</a>
      <span className="text-[#565959]">· 1,247 ratings</span>
    </div>
  );
}

function Gallery() {
  const [active, setActive] = useState(0);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-2">
        {ALL_IMAGES.map((u, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-12 w-12 overflow-hidden rounded border bg-white transition ${
              i === active
                ? "border-[#e67c00] ring-1 ring-[#e67c00]"
                : "border-[#d5d9d9] hover:border-[#e67c00]/60"
            }`}
          >
            <img src={u} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="flex min-h-[260px] flex-1 items-center justify-center rounded-lg border border-[#e7e9ec] bg-white p-4">
        <img
          src={ALL_IMAGES[active]}
          alt={PRODUCT_IMAGES.alt}
          className="max-h-[330px] max-w-full object-contain"
        />
      </div>
    </div>
  );
}

function AddToCart({
  inStock,
  onAdd,
  added,
}: {
  inStock: boolean;
  onAdd: () => void;
  added: boolean;
}) {
  return (
    <button
      onClick={onAdd}
      disabled={!inStock}
      className={`sense-press w-full rounded-full border px-5 py-2.5 text-[14px] font-semibold text-[#0f1111] transition ${
        inStock
          ? "border-[#fcd200] bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f2c200]"
          : "cursor-not-allowed border-[#e7e9ec] bg-[#e7e9ec] text-[#565959]"
      }`}
    >
      {added ? "✓ Added to cart" : inStock ? "Add to Cart" : "Currently unavailable"}
    </button>
  );
}

function BuyNow() {
  return (
    <button className="sense-press w-full rounded-full border border-[#ff8f00] bg-[#ffa41c] px-5 py-2.5 text-[14px] font-semibold text-[#0f1111] transition hover:bg-[#fa8900] active:bg-[#f58600]">
      Buy Now
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Template A — "Classic": classic Amazon 2-column (gallery + buy box)
 * ------------------------------------------------------------------ */

function TemplateA({
  price,
  compare,
  savePct,
  stockLabel,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  compare: string;
  savePct: number;
  stockLabel: string;
  inStock: boolean;
  onAdd: () => void;
  added: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-6xl px-4 py-4"
    >
      <Breadcrumbs name={PRODUCT_NAME} />
      <div className="mt-3 grid gap-6 rounded-lg border border-[#e7e9ec] bg-white p-5 md:grid-cols-[5fr_6fr]">
        <Gallery />
        <div className="product-container">
          <h1 className="text-[21px] font-normal leading-snug">{PRODUCT_NAME}</h1>
          <Stars />
          <div className="mt-1 text-[12px] text-[#565959]">
            Ships from and sold by <span className="text-[#007185]">aperture</span>.
          </div>
          <div className="my-2.5 border-b border-[#e7e9ec]" />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="price text-[26px] font-semibold">{price}</span>
            <span className="text-[13px] text-[#565959] line-through">{compare}</span>
            <span className="text-[13px] font-semibold text-[#cc0c39]">Save {savePct}%</span>
          </div>
          <span
            className={`stock mt-1 block text-[14px] font-semibold ${
              inStock ? "text-[#007600]" : "text-[#b12704]"
            }`}
          >
            {stockLabel}
          </span>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
            {BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 text-[13px]">
            <label className="text-[#565959]">Qty</label>
            <select className="rounded border border-[#d5d9d9] bg-[#f0f2f2] px-2 py-1 text-[13px] outline-none">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="mt-3.5 space-y-2.5">
            <AddToCart inStock={inStock} onAdd={onAdd} added={added} />
            <BuyNow />
          </div>
          <div className="mt-3 rounded border border-[#e7e9ec] bg-[#f7f7f7] p-3 text-[12px] leading-relaxed text-[#565959]">
            FREE delivery <b className="text-[#0f1111]">Friday, Aug 28</b> — order within 9 hrs.
            <br />
            Or fastest delivery <b className="text-[#0f1111]">Tomorrow</b>. In stock.
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Template B — "Modern": minimal DTC layout, hero image + centered box
 * ------------------------------------------------------------------ */

function TemplateB({
  price,
  compare,
  savePct,
  stockLabel,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  compare: string;
  savePct: number;
  stockLabel: string;
  inStock: boolean;
  onAdd: () => void;
  added: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="bg-[#f5f5f5]">
        <img
          src={PRODUCT_IMAGES.main}
          alt={PRODUCT_IMAGES.alt}
          className="mx-auto max-h-[300px] w-full object-contain"
        />
      </div>
      <div className="pricing-section mx-auto max-w-xl px-6 pb-10 pt-6 text-center">
        <Stars centered />
        <h1 className="mt-1 text-[24px] font-normal leading-snug">{PRODUCT_NAME}</h1>
        <p className="text-[13px] text-[#565959]">Classic high-top · Leather upper · Panda colorway</p>
        <div className="mt-4 flex flex-wrap items-baseline justify-center gap-2.5">
          <span data-test="current-price" className="text-[34px] font-bold">
            {price}
          </span>
          <span className="text-[13px] text-[#565959] line-through">{compare}</span>
          <span className="text-[13px] font-semibold text-[#cc0c39]">Save {savePct}%</span>
        </div>
        <div className="mt-2">
          <span
            data-test="availability"
            className={`text-[14px] font-semibold ${inStock ? "text-[#007600]" : "text-[#b12704]"}`}
          >
            {stockLabel}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          {["Leather upper", "Black Swoosh", "Rubber outsole", "Padded collar"].map((s) => (
            <div
              key={s}
              className="rounded-lg border border-[#e7e9ec] bg-[#f7f7f7] px-3 py-2.5 text-[13px] transition hover:border-[#d5d9d9]"
            >
              {s}
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2.5">
          <AddToCart inStock={inStock} onAdd={onAdd} added={added} />
          <BuyNow />
        </div>
        <p className="mt-3 text-[11px] text-[#565959]">
          Free 2-day shipping · 30-day returns · 1-year warranty
        </p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Template C — "Schema": Amazon layout + right rail + tabs + JSON-LD
 * ------------------------------------------------------------------ */

function TemplateC({
  price,
  compare,
  savePct,
  stockLabel,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  compare: string;
  savePct: number;
  stockLabel: string;
  inStock: boolean;
  onAdd: () => void;
  added: boolean;
}) {
  const [tab, setTab] = useState(0);
  const tabs = ["Description", "Specifications", "Shipping & Returns"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-6xl px-4 py-4"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: PRODUCT_NAME,
            image: PRODUCT_IMAGES.main,
            offers: {
              "@type": "Offer",
              price: price.replace(/[^0-9.]/g, ""),
              priceCurrency: "USD",
              availability: inStock ? "InStock" : "OutOfStock",
            },
          }),
        }}
      />
      <Breadcrumbs name={PRODUCT_NAME} />
      <div className="mt-3 grid gap-5 rounded-lg border border-[#e7e9ec] bg-white p-5 lg:grid-cols-[5fr_6fr_3fr]">
        <Gallery />
        <div className="buybox">
          <h1 className="text-[21px] font-normal leading-snug">{PRODUCT_NAME}</h1>
          <Stars />
          <div className="text-[12px] text-[#565959]">1,000+ bought in past month</div>
          <div className="my-2.5 border-b border-[#e7e9ec]" />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="display-price text-[26px] font-semibold">{price}</span>
            <span className="text-[13px] text-[#565959] line-through">{compare}</span>
            <span className="text-[13px] font-semibold text-[#cc0c39]">Save {savePct}%</span>
          </div>
          <div className="mt-2">
            <span
              className={`availability-badge inline-flex rounded-full px-3 py-1 text-[13px] font-semibold ${
                inStock ? "bg-[#e8f7ee] text-[#067647]" : "bg-[#fdecec] text-[#b12704]"
              }`}
            >
              {stockLabel}
            </span>
          </div>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
            {BULLETS.slice(0, 4).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-3.5 space-y-2.5">
            <AddToCart inStock={inStock} onAdd={onAdd} added={added} />
            <BuyNow />
          </div>
        </div>
        <aside className="rounded-lg border border-[#e7e9ec] p-4">
          <h3 className="text-[14px] font-semibold">Frequently bought together</h3>
          <div className="mt-2 space-y-2 border-b border-[#e7e9ec] pb-3">
            <div className="flex items-center gap-2.5">
              <img
                src={PRODUCT_IMAGES.gallery[2]}
                alt="socks"
                className="h-11 w-11 rounded border border-[#e7e9ec] object-cover"
              />
              <div>
                <div className="text-[12px] leading-tight">Nike Elite Crew Socks (3-pack)</div>
                <div className="mt-0.5 text-[12px] font-semibold">$18.00</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <img
                src={PRODUCT_IMAGES.gallery[1]}
                alt="shields"
                className="h-11 w-11 rounded border border-[#e7e9ec] object-cover"
              />
              <div>
                <div className="text-[12px] leading-tight">Sneaker Shields Inserts (2-pack)</div>
                <div className="mt-0.5 text-[12px] font-semibold">$9.00</div>
              </div>
            </div>
          </div>
          <button className="sense-press mt-3 w-full rounded-full border border-[#fcd200] bg-[#ffd814] px-4 py-2 text-[13px] font-semibold text-[#0f1111] transition hover:bg-[#f7ca00]">
            Buy all 3 · $166.00
          </button>
          <div className="mt-3 text-[12px] leading-relaxed text-[#565959]">
            <b className="text-[#0f1111]">Sold by</b> aperture · 100% positive feedback
            <br />
            Free returns · 30 days
            <br />
            In stock — ships within 24 hours
          </div>
        </aside>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b-2 border-[#e7e9ec]">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`border-b-2 px-4 py-2 text-[13px] transition ${
              tab === i
                ? "border-[#e67c00] font-semibold text-[#0f1111]"
                : "border-transparent text-[#565959] hover:text-[#0f1111]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="rounded-b-lg border border-t-0 border-[#e7e9ec] bg-white p-5 text-[13px] leading-relaxed">
        {tab === 0 && (
          <>
            <h4 className="mb-1 text-[13.5px] font-semibold">About this item</h4>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                The &quot;Panda&quot; Dunk — the colorway that turned a basketball icon into
                streetwear&apos;s most-wanted sneaker.
              </li>
              <li>Genuine leather upper with perforated toe box for breathability.</li>
              <li>
                High-top silhouette with padded collar, cushioned insole and pivot-circle traction.
              </li>
              <li>Fits true to size; runs narrow — size up half a size for wide feet.</li>
            </ul>
          </>
        )}
        {tab === 1 && (
          <table className="w-full border-collapse text-[12.5px]">
            {[
              ["Brand", "Nike"],
              ["Style", "DD1391-100"],
              ["Colorway", "White / Black \"Panda\""],
              ["Upper", "Genuine leather"],
              ["Midsole", "EVA foam"],
              ["Outsole", "Solid rubber"],
              ["Fit", "True to size"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="w-[38%] border-b border-[#e7e9ec] py-1.5 pr-2 text-[#565959]">{k}</td>
                <td className="border-b border-[#e7e9ec] py-1.5">{v}</td>
              </tr>
            ))}
          </table>
        )}
        {tab === 2 && (
          <ul className="list-disc space-y-1 pl-5">
            <li>Free 2-day shipping on orders over $50.</li>
            <li>30-day hassle-free returns.</li>
            <li>1-year manufacturer warranty included.</li>
          </ul>
        )}
      </div>
    </motion.div>
  );
}
