"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FEATURED_PRODUCTS,
  HERO_IMAGES,
  PRODUCT_IMAGES,
  PRODUCT_NAME,
} from "@/lib/store-shared";

interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
  stock_level: number;
}

interface HistoryPoint {
  price: number;
  at: string;
}

const ALL_IMAGES = [PRODUCT_IMAGES.main, ...PRODUCT_IMAGES.gallery];

const FINISHES = [
  { name: "Natural Titanium", hex: "#b8b2a6" },
  { name: "Blue Titanium", hex: "#3a4a63" },
  { name: "White Titanium", hex: "#d9d4c9" },
  { name: "Black Titanium", hex: "#2c2c2e" },
];

const STORAGE = ["128GB", "256GB", "512GB", "1TB"];

const BULLETS = [
  "A17 Pro chip with a 6-core GPU for console-class gaming.",
  "Aerospace-grade titanium — the lightest Pro model ever.",
  "48MP Pro camera system with up to 3x telephoto.",
  "USB-C connector and all-day battery life.",
];

const REVIEWS = [
  {
    name: "Marcus T.",
    stars: "★★★★★",
    date: "Reviewed Aug 14, 2026",
    text: "Titanium feels incredible and the camera is a huge step up. Battery easily lasts me all day.",
    helpful: "312 people found this helpful",
  },
  {
    name: "Priya S.",
    stars: "★★★★★",
    date: "Reviewed Aug 6, 2026",
    text: "Had SENSE watching the page for a price drop — it pinged me the second it went below my target. Zero stress.",
    helpful: "204 people found this helpful",
  },
  {
    name: "Danny R.",
    stars: "★★★★☆",
    date: "Reviewed Jul 29, 2026",
    text: "USB-C finally. Action button is a nice touch. Four stars only because the box arrived a bit scuffed.",
    helpful: "118 people found this helpful",
  },
];

export default function StorePanel({
  onOpenBreak,
  watchSignal,
}: {
  onOpenBreak: () => void;
  watchSignal: number;
}) {
  const [product, setProduct] = useState<ProductState | null>(null);
  const [view, setView] = useState<"storefront" | "product">("storefront");
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/products/iphone-15-pro/history");
      const d = await r.json();
      if (Array.isArray(d.points)) setHistory(d.points);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/products/iphone-15-pro");
      setProduct(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    loadHistory();
    const t = setInterval(loadHistory, 8000);
    const es = new EventSource("/api/store/stream");
    es.onmessage = (e) => {
      try {
        setProduct(JSON.parse(e.data));
        loadHistory();
      } catch {
        /* ignore */
      }
    };
    return () => {
      clearInterval(t);
      es.close();
    };
  }, [load, loadHistory]);

  // When a watch is created (via SENSE chat), reveal the product detail page
  // so the user sees the very thing SENSE is watching.
  useEffect(() => {
    if (watchSignal > 0) setView("product");
  }, [watchSignal]);

  return (
    <div className="relative flex h-full flex-col bg-white text-[#1d1d1f]">
      <StoreNav />

      <div className="sense-scroll relative min-h-0 flex-1 overflow-y-auto pb-16">
        <AnimatePresence mode="wait">
          {view === "storefront" ? (
            <motion.div
              key="storefront"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Storefront
                onShop={() => setView("product")}
                onOpenProduct={() => setView("product")}
                watching={Boolean(product)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="product"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {product ? (
                <ProductDetail
                  product={product}
                  history={history}
                  onBack={() => setView("storefront")}
                />
              ) : (
                <div className="flex h-full items-center justify-center py-24 font-mono text-sm text-[#6e6e73]">
                  Loading product…
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <StoreFooter />
      </div>

      {/* Floating break button (product view only) */}
      {view === "product" && (
        <div className="pointer-events-none absolute bottom-16 right-6 z-20">
          <button
            onClick={onOpenBreak}
            className="sense-press pointer-events-auto flex items-center gap-2 rounded-full border border-[#ff2d55]/50 bg-[#1d1d1f]/95 px-4 py-2.5 font-mono text-[12px] font-medium text-white shadow-lg backdrop-blur transition hover:border-[#ff2d55]"
          >
            ⚙ Break This Site
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Store navigation (Apple-style)
 * ------------------------------------------------------------------ */

function StoreNav() {
  const links = [
    "Store",
    "Mac",
    "iPad",
    "iPhone",
    "Watch",
    "AirPods",
    "Accessories",
    "Support",
  ];
  return (
    <header className="flex h-[57px] shrink-0 items-center gap-6 border-b border-[#e8e8ed] bg-white px-6 text-[13px] text-[#1d1d1f]">
      <span className="text-[17px] font-semibold leading-none"></span>
      {links.map((l, i) => (
        <span
          key={l}
          className={`hidden cursor-pointer whitespace-nowrap transition-colors hover:text-[#0071e3] ${
            i === 0 ? "font-medium" : ""
          } ${i < 2 ? "sm:block" : "lg:block"}`}
        >
          {l}
        </span>
      ))}
      <div className="ml-auto flex items-center gap-5 text-[16px] text-[#1d1d1f]">
        <span className="cursor-pointer transition-colors hover:text-[#0071e3]">⌕</span>
        <span className="cursor-pointer transition-colors hover:text-[#0071e3]">▢</span>
      </div>
    </header>
  );
}

function StoreFooter() {
  return (
    <footer className="border-t border-[#e8e8ed] bg-[#f5f5f7] px-4 py-3 text-center text-[11px] text-[#6e6e73]">
      aperture · Apple &amp; more · Free delivery · 30-day returns · © 2026
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Storefront — hero + benefits + featured products
 * ------------------------------------------------------------------ */

function Storefront({
  onShop,
  onOpenProduct,
}: {
  onShop: () => void;
  onOpenProduct: () => void;
  watching: boolean;
}) {
  return (
    <div>
      {/* Heading */}
      <div className="mx-auto flex max-w-5xl items-baseline justify-between px-6 pt-6">
        <h2 className="text-[24px] font-bold tracking-tight">Store</h2>
        <span className="cursor-pointer text-[13px] text-[#0066cc] hover:underline">
          Browse all ▾
        </span>
      </div>

      {/* Hero */}
      <div className="mx-6 mt-4 overflow-hidden rounded-[16px] bg-gradient-to-br from-[#fafafa] to-[#f1f1f4]">
        <div className="relative flex min-h-[260px] items-center px-8 py-8">
          <div className="relative z-10 max-w-[320px]">
            <h3 className="text-[34px] font-bold leading-[1.05] tracking-[-1px] text-[#1d1d1f]">
              New season.
              <br />
              Elevated.
            </h3>
            <p className="mt-3 text-[14px] leading-snug text-[#6e6e73]">
              Explore the latest in tech, style, and everyday essentials.
            </p>
            <button
              onClick={onShop}
              className="mt-5 rounded-full bg-[#0071e3] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0077ed]"
            >
              Shop Now
            </button>
          </div>

          {/* Product cluster */}
          <div className="absolute inset-y-0 right-0 w-[58%]">
            <img
              src={HERO_IMAGES.phone}
              alt="iPhone"
              className="absolute right-[38%] top-1/2 h-[82%] w-auto -translate-y-1/2 rotate-[4deg] rounded-[22px] object-contain shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]"
            />
            <img
              src={HERO_IMAGES.buds}
              alt="AirPods"
              className="absolute bottom-[6%] right-[52%] h-[34%] w-auto rounded-[16px] object-contain shadow-[0_10px_24px_-8px_rgba(0,0,0,0.3)]"
            />
            <img
              src={HERO_IMAGES.watch}
              alt="Apple Watch"
              className="absolute bottom-[8%] right-[6%] h-[40%] w-auto rounded-[16px] object-contain shadow-[0_12px_26px_-8px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="mx-6 mt-5 grid grid-cols-4 gap-3">
        {[
          { icon: "▱", title: "Free shipping", sub: "On every order" },
          { icon: "◷", title: "30-day return", sub: "No questions asked" },
          { icon: "▣", title: "Secure payment", sub: "Encrypted checkout" },
          { icon: "⌕", title: "Specialist support", sub: "Real humans" },
        ].map((b) => (
          <div
            key={b.title}
            className="flex min-h-[61px] items-center gap-3 rounded-[12px] border border-[#e5e5e7] px-3.5 py-2.5"
          >
            <span className="text-[19px] leading-none text-[#0071e3]">{b.icon}</span>
            <div>
              <div className="text-[12px] font-semibold text-[#1d1d1f]">{b.title}</div>
              <div className="mt-0.5 text-[10px] text-[#6e6e73]">{b.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Featured products */}
      <div className="mx-6 mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[17px] font-semibold">Featured Products</h4>
          <span className="cursor-pointer text-[12px] text-[#0066cc] hover:underline">
            See All
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {FEATURED_PRODUCTS.map((p, i) => {
            const isWatched = i === 0;
            return (
              <button
                key={p.id}
                onClick={() => isWatched && onOpenProduct()}
                className={`group relative rounded-[12px] border border-[#e4e4e6] bg-white p-3 text-left transition hover:shadow-md ${
                  isWatched ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {p.tag && (
                  <span className="absolute left-3 top-3 rounded-full bg-[#0071e3] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    {p.tag}
                  </span>
                )}
                {isWatched && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#0077a3]">
                    <span className="h-1 w-1 rounded-full bg-[#00d4ff]" /> SENSE
                  </span>
                )}
                <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-[8px] bg-[#fafafa]">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="mt-2 truncate text-[11px] font-semibold text-[#1d1d1f]">
                  {p.name}
                </div>
                <div className="mt-1 text-[11px] font-medium text-[#6e6e73]">
                  ${p.price}
                </div>
                <div className="mt-1.5 flex gap-1">
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="h-[7px] w-[7px] rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Product detail — the watched product (break/heal target)
 * ------------------------------------------------------------------ */

function ProductDetail({
  product,
  history,
  onBack,
}: {
  product: ProductState;
  history: HistoryPoint[];
  onBack: () => void;
}) {
  const [finish, setFinish] = useState(0);
  const [storage, setStorage] = useState(0);
  const [added, setAdded] = useState(false);

  const price = `$${Number(product.price).toFixed(2)}`;
  const compare = `$${Math.max(
    product.price + 1,
    Math.round(Number(product.price) / 0.9),
  ).toFixed(2)}`;
  const savePct = Math.max(
    1,
    Math.round(
      ((Math.max(product.price + 1, Math.round(Number(product.price) / 0.9)) -
        Number(product.price)) /
        Math.max(product.price + 1, Math.round(Number(product.price) / 0.9))) *
        100,
    ),
  );
  const inStock = product.in_stock;
  const stockLabel = inStock ? "In Stock" : "Out of Stock";

  const addToBag = () => {
    if (!inStock) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const shared = {
    price,
    compare,
    savePct,
    inStock,
    stockLabel,
    stockLevel: product.stock_level,
    finish,
    setFinish,
    storage,
    setStorage,
    added,
    addToBag,
    history,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 pt-5">
      <button
        onClick={onBack}
        className="mb-3 text-[13px] text-[#0066cc] hover:underline"
      >
        ← Back to Store
      </button>
      <div className="text-[12px] text-[#6e6e73]">
        Store › iPhone › <span className="text-[#1d1d1f]">{PRODUCT_NAME}</span>
      </div>

      <AnimatePresence mode="wait">
        {product.template === "A" && <TemplateA key="A" {...shared} />}
        {product.template === "B" && <TemplateB key="B" {...shared} />}
        {product.template === "C" && <TemplateC key="C" {...shared} />}
      </AnimatePresence>
    </div>
  );
}

interface SharedProps {
  price: string;
  compare: string;
  savePct: number;
  inStock: boolean;
  stockLabel: string;
  stockLevel: number;
  finish: number;
  setFinish: (i: number) => void;
  storage: number;
  setStorage: (i: number) => void;
  added: boolean;
  addToBag: () => void;
  history: HistoryPoint[];
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
            className={`h-[56px] w-[56px] overflow-hidden rounded-[10px] border bg-white transition ${
              i === active ? "border-[#0071e3] ring-1 ring-[#0071e3]" : "border-[#e8e8ed] hover:border-[#0071e3]/50"
            }`}
          >
            <img src={u} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="group flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-[16px] bg-[#f5f5f7] p-5">
        <img
          src={ALL_IMAGES[active]}
          alt={PRODUCT_IMAGES.alt}
          className="max-h-[360px] max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.05]"
        />
      </div>
    </div>
  );
}

function FinishPicker({
  finish,
  setFinish,
}: {
  finish: number;
  setFinish: (i: number) => void;
}) {
  return (
    <div className="mt-3.5">
      <div className="text-[13px] font-semibold">Finish</div>
      <div className="mt-2 flex items-center gap-2.5">
        {FINISHES.map((f, i) => (
          <button
            key={f.name}
            onClick={() => setFinish(i)}
            title={f.name}
            className={`h-6 w-6 rounded-full border transition ${
              i === finish
                ? "border-[#0071e3] ring-2 ring-[#0071e3] ring-offset-2"
                : "border-[#d2d2d7] hover:border-[#0071e3]/60"
            }`}
            style={{ background: f.hex }}
          />
        ))}
        <span className="ml-1 text-[12px] text-[#6e6e73]">{FINISHES[finish].name}</span>
      </div>
    </div>
  );
}

function StoragePicker({
  storage,
  setStorage,
}: {
  storage: number;
  setStorage: (i: number) => void;
}) {
  return (
    <div className="mt-3.5">
      <div className="text-[13px] font-semibold">Storage</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {STORAGE.map((s, i) => (
          <button
            key={s}
            onClick={() => setStorage(i)}
            className={`rounded-[10px] border px-4 py-1.5 text-[13px] font-medium transition ${
              i === storage
                ? "border-[#0071e3] text-[#0071e3] shadow-[inset_0_0_0_1px_#0071e3]"
                : "border-[#d2d2d7] text-[#1d1d1f] hover:border-[#0071e3]/60"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Urgency({ inStock, stockLevel }: { inStock: boolean; stockLevel: number }) {
  if (!inStock)
    return <div className="mt-1.5 text-[12.5px] font-semibold text-[#c00]">Currently unavailable.</div>;
  return stockLevel <= 5 ? (
    <div className="mt-1.5 text-[12.5px] font-semibold text-[#c00]">
      Only {stockLevel} left in stock — order soon.
    </div>
  ) : (
    <div className="mt-1.5 text-[12.5px] font-semibold text-[#007a3d]">In stock — ready to ship.</div>
  );
}

function AddToBag({ inStock, onAdd, added }: { inStock: boolean; onAdd: () => void; added: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={!inStock}
      className={`sense-press mt-4 w-full rounded-[12px] px-5 py-3 text-[15px] font-semibold transition ${
        inStock
          ? "bg-[#0071e3] text-white hover:bg-[#0077ed]"
          : "cursor-not-allowed bg-[#e8e8ed] text-[#6e6e73]"
      }`}
    >
      {added ? "✓ Added to Bag" : inStock ? "Add to Bag" : "Currently unavailable"}
    </button>
  );
}

function BuyButton() {
  return (
    <button className="sense-press mt-2.5 w-full rounded-[12px] border border-[#0071e3] bg-white px-5 py-3 text-[15px] font-semibold text-[#0071e3] transition hover:bg-[#f5f5f7]">
      Buy
    </button>
  );
}

function Sparkline({ points }: { points: HistoryPoint[] }) {
  const W = 260;
  const H = 56;
  if (points.length < 2) {
    return (
      <div className="mt-3 rounded-[10px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-3 py-2.5 text-[11px] text-[#6e6e73]">
        <span className="font-medium text-[#1d1d1f]">Price history</span> — builds as SENSE checks…
      </div>
    );
  }
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(max - min, 1);
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - 5 - ((p.price - min) / span) * (H - 10),
  }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <div className="mt-3 rounded-[10px] border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
      <div className="flex items-center justify-between text-[11px] text-[#6e6e73]">
        <span className="font-medium text-[#1d1d1f]">Price history</span>
        <span>
          low <b className="text-[#1d1d1f]">${Math.min(...prices)}</b> · now{" "}
          <b className="text-[#1d1d1f]">${prices[prices.length - 1]}</b>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 w-full" preserveAspectRatio="none">
        <polyline
          points={line}
          fill="none"
          stroke="#0071e3"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r="3" fill="#0071e3" />
      </svg>
    </div>
  );
}

function Reviews() {
  return (
    <section className="mt-6 rounded-[16px] bg-[#f5f5f7] p-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div>
          <h2 className="text-[16px] font-semibold">Ratings &amp; Reviews</h2>
          <div className="mt-2 text-[32px] font-bold leading-none">4.9</div>
          <div className="mt-1 text-[14px] text-[#e67c00]">★★★★★</div>
          <div className="text-[12px] text-[#6e6e73]">2,431 global ratings</div>
          <div className="mt-4 space-y-1.5">
            {[
              [5, 82],
              [4, 12],
              [3, 3],
              [2, 1],
              [1, 2],
            ].map(([s, pct]) => (
              <div key={s} className="flex items-center gap-2 text-[12px] text-[#6e6e73]">
                <span className="w-5">{s}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e0e0e5]">
                  <div className="h-full rounded-full bg-[#e67c00]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {REVIEWS.map((r) => (
            <div key={r.name} className="border-b border-[#e0e0e5] pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold">{r.name}</span>
                <span className="text-[#e67c00]">{r.stars}</span>
                <span className="text-[11px] text-[#6e6e73]">{r.date}</span>
                <span className="rounded-full bg-[#e5f6ec] px-2 py-0.5 text-[10px] font-medium text-[#007a3d]">
                  ✓ Verified purchase
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{r.text}</p>
              <div className="mt-1 text-[11px] text-[#6e6e73]">{r.helpful}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- Template A — Apple 2-column (gallery + buy box) ---- */

function TemplateA(props: SharedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="mt-3 grid gap-9 md:grid-cols-2">
        <Gallery />
        <div className="product-container">
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.5px]">{PRODUCT_NAME}</h1>
          <p className="mt-1 text-[16px] text-[#6e6e73]">Titanium. So strong. So light. Pro.</p>
          <div className="my-4 border-b border-[#e8e8ed]" />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="price text-[30px] font-bold tracking-tight">{props.price}</span>
            <span className="text-[14px] text-[#6e6e73] line-through">{props.compare}</span>
            <span className="text-[14px] font-semibold text-[#c00]">Save {props.savePct}%</span>
          </div>
          <span className={`stock mt-1 block text-[14px] font-semibold ${props.inStock ? "text-[#007a3d]" : "text-[#c00]"}`}>
            {props.stockLabel}
          </span>
          <Urgency inStock={props.inStock} stockLevel={props.stockLevel} />
          <Sparkline points={props.history} />
          <FinishPicker finish={props.finish} setFinish={props.setFinish} />
          <StoragePicker storage={props.storage} setStorage={props.setStorage} />
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
            {BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <AddToBag inStock={props.inStock} onAdd={props.addToBag} added={props.added} />
          <BuyButton />
          <div className="mt-4 rounded-[12px] bg-[#f5f5f7] p-3.5 text-[13px] leading-relaxed text-[#1d1d1f]">
            <b>Free delivery</b> — in stock.
            <br />
            Ships within 24 hours · 30-day returns.
          </div>
        </div>
      </div>
      <Reviews />
    </motion.div>
  );
}

/* ---- Template B — full-bleed hero + centered buy box ---- */

function TemplateB(props: SharedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="-mx-6"
    >
      <div className="bg-[#f5f5f7]">
        <img
          src={PRODUCT_IMAGES.main}
          alt={PRODUCT_IMAGES.alt}
          className="mx-auto max-h-[280px] w-full object-contain"
        />
      </div>
      <div className="pricing-section mx-auto max-w-xl px-6 pb-10 pt-6 text-center">
        <h1 className="text-[28px] font-bold tracking-tight">{PRODUCT_NAME}</h1>
        <p className="text-[14px] text-[#6e6e73]">Titanium. So strong. So light. Pro.</p>
        <div className="mt-4 flex flex-wrap items-baseline justify-center gap-2.5">
          <span data-test="current-price" className="text-[38px] font-bold tracking-tight">
            {props.price}
          </span>
          <span className="text-[14px] text-[#6e6e73] line-through">{props.compare}</span>
          <span className="text-[14px] font-semibold text-[#c00]">Save {props.savePct}%</span>
        </div>
        <div className="mt-2">
          <span data-test="availability" className={`text-[14px] font-semibold ${props.inStock ? "text-[#007a3d]" : "text-[#c00]"}`}>
            {props.stockLabel}
          </span>
        </div>
        <Urgency inStock={props.inStock} stockLevel={props.stockLevel} />
        <div className="mx-auto max-w-xs text-left">
          <Sparkline points={props.history} />
        </div>
        <div className="mt-3 flex justify-center">
          <FinishPicker finish={props.finish} setFinish={props.setFinish} />
        </div>
        <div className="mt-3 flex justify-center">
          <StoragePicker storage={props.storage} setStorage={props.setStorage} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          {["A17 Pro chip", "Titanium design", "48MP camera", "USB-C"].map((s) => (
            <div key={s} className="rounded-[10px] bg-[#f5f5f7] px-3.5 py-2.5 text-[13px] transition hover:bg-[#ececf0]">
              {s}
            </div>
          ))}
        </div>
        <div className="mt-5">
          <AddToBag inStock={props.inStock} onAdd={props.addToBag} added={props.added} />
          <BuyButton />
        </div>
        <p className="mt-3 text-[11px] text-[#6e6e73]">Free delivery · 30-day returns · 1-year warranty</p>
        <div className="mt-6 rounded-[10px] bg-white px-4 py-3 text-left">
          <p className="text-[12.5px] italic leading-relaxed text-[#333]">
            ★★★★★ &ldquo;Had SENSE watch this page for me — got the alert, ordered instantly.&rdquo; — Priya S.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ---- Template C — 3-column + rail + tabs + JSON-LD ---- */

function TemplateC(props: SharedProps) {
  const [tab, setTab] = useState(0);
  const tabs = ["Overview", "Tech Specs", "Shipping & Returns"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="mt-3 grid gap-7 lg:grid-cols-[1fr_1.1fr_0.7fr]">
        <Gallery />
        <div className="buybox">
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.5px]">{PRODUCT_NAME}</h1>
          <p className="mt-1 text-[16px] text-[#6e6e73]">Titanium. So strong. So light. Pro.</p>
          <div className="my-4 border-b border-[#e8e8ed]" />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="display-price text-[30px] font-bold tracking-tight">{props.price}</span>
            <span className="text-[14px] text-[#6e6e73] line-through">{props.compare}</span>
            <span className="text-[14px] font-semibold text-[#c00]">Save {props.savePct}%</span>
          </div>
          <div className="mt-2">
            <span className={`availability-badge inline-flex rounded-full px-3 py-1 text-[13px] font-semibold ${props.inStock ? "bg-[#e5f6ec] text-[#007a3d]" : "bg-[#fdeaea] text-[#c00]"}`}>
              {props.stockLabel}
            </span>
          </div>
          <Urgency inStock={props.inStock} stockLevel={props.stockLevel} />
          <Sparkline points={props.history} />
          <FinishPicker finish={props.finish} setFinish={props.setFinish} />
          <StoragePicker storage={props.storage} setStorage={props.setStorage} />
          <AddToBag inStock={props.inStock} onAdd={props.addToBag} added={props.added} />
          <BuyButton />
        </div>
        <aside className="rounded-[16px] border border-[#e8e8ed] p-4">
          <h3 className="text-[14px] font-semibold">Why iPhone</h3>
          <div className="mt-2 space-y-2 border-b border-[#e8e8ed] pb-3">
            <div className="flex items-center gap-2.5">
              <img src={PRODUCT_IMAGES.gallery[1]} alt="trade-in" className="h-11 w-11 rounded-[8px] border border-[#e8e8ed] object-cover" />
              <div>
                <div className="text-[12px] leading-tight">Apple Trade In</div>
                <div className="mt-0.5 text-[12px] font-semibold">Save up to $630</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <img src={PRODUCT_IMAGES.gallery[3]} alt="applecare" className="h-11 w-11 rounded-[8px] border border-[#e8e8ed] object-cover" />
              <div>
                <div className="text-[12px] leading-tight">AppleCare+</div>
                <div className="mt-0.5 text-[12px] font-semibold">From $9.99/mo.</div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[12px] leading-relaxed text-[#6e6e73]">
            <b className="text-[#1d1d1f]">Sold by</b> aperture · 100% positive feedback
            <br />
            Free returns · 30 days
            <br />
            In stock — ships within 24 hours
          </div>
        </aside>
      </div>

      <div className="mt-5 flex gap-1 border-b-2 border-[#e8e8ed]">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`border-b-2 px-4 py-2 text-[13px] transition ${
              tab === i ? "border-[#0071e3] font-semibold text-[#1d1d1f]" : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="rounded-b-[16px] border border-t-0 border-[#e8e8ed] bg-white p-5 text-[13px] leading-relaxed">
        {tab === 0 && (
          <>
            <h4 className="mb-1 text-[13.5px] font-semibold">Overview</h4>
            <ul className="list-disc space-y-1 pl-5">
              <li>Titanium design — the lightest, strongest Pro iPhone ever.</li>
              <li>A17 Pro chip brings console-class gaming to a phone.</li>
              <li>48MP Pro camera system with up to 3x optical zoom.</li>
              <li>USB-C, Action button, and all-day battery life.</li>
            </ul>
          </>
        )}
        {tab === 1 && (
          <table className="w-full border-collapse text-[12.5px]">
            {[
              ["Display", '6.1" Super Retina XDR · ProMotion'],
              ["Chip", "A17 Pro"],
              ["Camera", "48MP main · 3x telephoto · 12MP ultrawide"],
              ["Connector", "USB-C"],
              ["Battery", "Up to 29 hours video playback"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="w-[38%] border-b border-[#e8e8ed] py-1.5 pr-2 text-[#6e6e73]">{k}</td>
                <td className="border-b border-[#e8e8ed] py-1.5">{v}</td>
              </tr>
            ))}
          </table>
        )}
        {tab === 2 && (
          <ul className="list-disc space-y-1 pl-5">
            <li>Free delivery, in stock.</li>
            <li>30-day hassle-free returns.</li>
            <li>1-year warranty included.</li>
          </ul>
        )}
      </div>
      <Reviews />
    </motion.div>
  );
}
