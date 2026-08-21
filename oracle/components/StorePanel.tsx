"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
}

export default function StorePanel({
  onOpenBreak,
}: {
  onOpenBreak: () => void;
}) {
  const [product, setProduct] = useState<ProductState | null>(null);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/products/sony-a7iv");
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
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-sm text-sense-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sense-electric border-t-transparent" />
          Loading store…
        </div>
      </div>
    );
  }

  const price = `$${product.price.toLocaleString()}`;
  const stockLabel = product.in_stock ? "In Stock" : "Out of Stock";
  const stockColor = product.in_stock ? "text-sense-success" : "text-sense-danger";

  const addToCart = () => {
    if (!product.in_stock) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Product area */}
      <div className="sense-scroll min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <AnimatePresence mode="wait">
          {product.template === "A" && (
            <TemplateA
              key="A"
              price={price}
              stockLabel={stockLabel}
              stockColor={stockColor}
              inStock={product.in_stock}
              onAdd={addToCart}
              added={added}
            />
          )}
          {product.template === "B" && (
            <TemplateB
              key="B"
              price={price}
              stockLabel={stockLabel}
              stockColor={stockColor}
              inStock={product.in_stock}
              onAdd={addToCart}
              added={added}
            />
          )}
          {product.template === "C" && (
            <TemplateC
              key="C"
              price={price}
              stockLabel={stockLabel}
              stockColor={stockColor}
              inStock={product.in_stock}
              onAdd={addToCart}
              added={added}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Floating Break button */}
      <div className="pointer-events-none absolute bottom-20 right-6 z-20 sm:bottom-24">
        <button
          onClick={onOpenBreak}
          className="sense-press pointer-events-auto flex items-center gap-2 rounded-xl border border-sense-danger/40 bg-sense-tertiary/90 px-4 py-2.5 font-mono text-[12px] font-medium text-sense-danger shadow-[0_8px_30px_-10px_rgba(255,45,85,0.4)] backdrop-blur transition hover:border-sense-danger/70 hover:bg-sense-danger/10 hover:shadow-[0_8px_30px_-8px_rgba(255,45,85,0.55)]"
        >
          ⚙ Break This Site
        </button>
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function ProductImage({ variant }: { variant: "classic" | "circle" | "banner" }) {
  if (variant === "circle") {
    return (
      <div className="mx-auto mb-7 aspect-square w-48 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 p-10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.06]">
        <CameraIcon className="h-full w-full text-slate-600" />
      </div>
    );
  }
  if (variant === "banner") {
    return (
      <div className="mb-6 aspect-[21/9] rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-8 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.05]">
        <div className="flex h-full items-center justify-center">
          <CameraIcon className="h-32 w-32 text-slate-600" />
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6 aspect-[3/2] rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-8 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.05] transition duration-300 hover:ring-white/[0.1]">
      <div className="flex h-full items-center justify-center">
        <CameraIcon className="h-24 w-24 text-slate-600 transition-transform duration-300 hover:scale-105" />
      </div>
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="16" y="22" width="48" height="36" rx="6" />
      <rect x="28" y="16" width="24" height="6" rx="2" />
      <circle cx="40" cy="40" r="12" />
      <circle cx="40" cy="40" r="4" opacity="0.6" />
    </svg>
  );
}

function AddToCartButton({
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
      className={`sense-press w-full rounded-xl px-5 py-3 text-sm font-semibold transition ${
        inStock
          ? "bg-sense-electric text-black shadow-[0_8px_30px_-10px_rgba(0,212,255,0.55)] hover:brightness-110"
          : "cursor-not-allowed bg-white/[0.04] text-sense-dim"
      }`}
    >
      {added ? "✓ Added to cart" : inStock ? "Add to Cart" : "Out of Stock"}
    </button>
  );
}

function Stars() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[12px] tracking-tight text-sense-warning">★★★★★</span>
      <span className="text-sense-muted">4.8</span>
      <span className="text-sense-dim">· 1,247 reviews</span>
    </span>
  );
}

/* ---- Template A: Classic ---- */

function TemplateA({
  price,
  stockLabel,
  stockColor,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
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
      className="product-container"
    >
      <ProductImage variant="classic" />
      <h1 className="text-xl font-semibold tracking-tight text-sense-text">
        Sony A7IV (Body Only)
      </h1>
      <div className="mt-1.5">
        <Stars />
      </div>
      <div className="mt-5 flex items-baseline gap-3">
        <span className="price font-mono text-3xl font-bold tracking-tight text-sense-text">
          {price}
        </span>
        <span className="font-mono text-[12px] text-sense-dim">USD</span>
      </div>
      <div className="mt-2.5">
        <span className={`stock flex items-center gap-1.5 font-mono text-[13px] ${stockColor}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              inStock ? "bg-sense-success shadow-[0_0_6px_#00ff88]" : "bg-sense-danger"
            }`}
          />
          {stockLabel}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          "33 MP Full-Frame CMOS",
          "4K 60p · 10-bit",
          "5-axis IBIS",
          "759-point AF",
        ].map((spec) => (
          <div
            key={spec}
            className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-sense-muted transition hover:border-white/[0.12] hover:text-sense-text"
          >
            {spec}
          </div>
        ))}
      </div>
      <div className="mt-6">
        <AddToCartButton inStock={inStock} onAdd={onAdd} added={added} />
      </div>
    </motion.div>
  );
}

/* ---- Template B: Modern ---- */

function TemplateB({
  price,
  stockLabel,
  stockColor,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
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
      className="pricing-section text-center"
    >
      <ProductImage variant="circle" />
      <h1 className="text-2xl font-bold tracking-tight text-sense-text">
        Sony α7 IV
      </h1>
      <p className="mt-1 text-[13px] text-sense-muted">Full-Frame Mirrorless Camera</p>
      <div className="mt-6 font-mono">
        <span
          data-test="current-price"
          className="text-4xl font-bold tracking-tight text-sense-text"
        >
          {price}
        </span>
        <span className="ml-2 text-[13px] text-sense-dim">USD</span>
      </div>
      <div className="mt-3">
        <span
          data-test="availability"
          className={`inline-flex items-center gap-1.5 font-mono text-[13px] ${stockColor}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              inStock ? "bg-sense-success shadow-[0_0_6px_#00ff88]" : "bg-sense-danger"
            }`}
          />
          {stockLabel}
        </span>
      </div>
      <div className="mt-7 flex justify-center gap-2">
        <span className="rounded-full bg-sense-tertiary/80 px-3.5 py-1.5 font-mono text-[12px] text-sense-muted">
          ★ 4.8
        </span>
        <span className="rounded-full bg-sense-tertiary/80 px-3.5 py-1.5 font-mono text-[12px] text-sense-muted">
          1,247 reviews
        </span>
      </div>
      <div className="mx-auto mt-7 max-w-xs">
        <AddToCartButton inStock={inStock} onAdd={onAdd} added={added} />
      </div>
    </motion.div>
  );
}

/* ---- Template C: Schema ---- */

function TemplateC({
  price,
  stockLabel,
  stockColor,
  inStock,
  onAdd,
  added,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@type": "Offer",
            price: price.replace(/[^0-9]/g, ""),
            priceCurrency: "USD",
            availability: stockLabel === "In Stock" ? "InStock" : "OutOfStock",
          }),
        }}
      />
      <ProductImage variant="banner" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-sense-text">
            Sony A7IV
          </h1>
          <p className="mt-1 text-[13px] text-sense-muted">
            Full-Frame Mirrorless · SKU: ILCE-7M4
          </p>
        </div>
        <span className={`flex items-center gap-1.5 font-mono text-[13px] ${stockColor}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              inStock ? "bg-sense-success shadow-[0_0_6px_#00ff88]" : "bg-sense-danger"
            }`}
          />
          {stockLabel}
        </span>
      </div>
      <div className="mt-5 flex items-baseline gap-2 font-mono">
        <span className="display-price text-3xl font-bold tracking-tight text-sense-text">
          {price}
        </span>
        <span className="text-[13px] text-sense-muted">USD</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-sense-muted">★ 4.8 (1,247)</span>
        <span className="availability-badge font-mono text-[12px] text-sense-dim">
          {stockLabel === "In Stock" ? "Available now" : "Currently unavailable"}
        </span>
      </div>
      <div className="mt-6">
        <AddToCartButton inStock={inStock} onAdd={onAdd} added={added} />
      </div>
    </motion.div>
  );
}
