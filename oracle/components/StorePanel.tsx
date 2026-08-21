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
        <div className="font-mono text-sm text-sense-muted">Loading store…</div>
      </div>
    );
  }

  const price = `$${product.price.toLocaleString()}`;
  const stockLabel = product.in_stock ? "In Stock" : "Out of Stock";
  const stockColor = product.in_stock ? "text-sense-success" : "text-sense-danger";

  return (
    <div className="flex h-full flex-col">
      {/* Product area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {product.template === "A" && (
            <TemplateA key="A" price={price} stockLabel={stockLabel} stockColor={stockColor} />
          )}
          {product.template === "B" && (
            <TemplateB key="B" price={price} stockLabel={stockLabel} stockColor={stockColor} />
          )}
          {product.template === "C" && (
            <TemplateC key="C" price={price} stockLabel={stockLabel} stockColor={stockColor} />
          )}
        </AnimatePresence>
      </div>

      {/* Floating Break button */}
      <div className="pointer-events-none absolute bottom-20 right-6 z-20 sm:bottom-24">
        <button
          onClick={onOpenBreak}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-sense-danger/50 bg-sense-tertiary/90 px-4 py-2.5 font-mono text-[12px] font-medium text-sense-danger backdrop-blur transition hover:bg-sense-danger/10"
        >
          ⚙ Break This Site
        </button>
      </div>
    </div>
  );
}

/* ---- Template A: Classic ---- */

function TemplateA({
  price,
  stockLabel,
  stockColor,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="product-container"
    >
      <div className="mb-6 aspect-[3/2] rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-8">
        <div className="flex h-full items-center justify-center">
          <svg className="h-24 w-24 text-slate-600" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="16" y="22" width="48" height="36" rx="6" />
            <rect x="28" y="16" width="24" height="6" rx="2" />
            <circle cx="40" cy="40" r="12" />
          </svg>
        </div>
      </div>
      <h1 className="text-xl font-semibold text-sense-text">Sony A7IV (Body Only)</h1>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[13px] text-sense-muted">★ 4.8 · 1,247 reviews</span>
      </div>
      <div className="mt-4 font-mono">
        <span className="price text-3xl font-bold text-sense-text">{price}</span>
      </div>
      <div className="mt-2">
        <span className={`stock font-mono text-[13px] ${stockColor}`}>{stockLabel}</span>
      </div>
      <div className="mt-6 space-y-2 font-mono text-[12px] text-sense-muted">
        <p>33 MP Full-Frame CMOS · 4K 60p · 5-axis IBIS</p>
        <p>10 fps continuous · 759 AF points · S-Cinetone</p>
      </div>
    </motion.div>
  );
}

/* ---- Template B: Modern ---- */

function TemplateB({
  price,
  stockLabel,
  stockColor,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pricing-section text-center"
    >
      <div className="mb-7 mx-auto aspect-square w-48 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 p-10">
        <svg className="h-full w-full text-slate-600" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="16" y="22" width="48" height="36" rx="6" />
          <rect x="28" y="16" width="24" height="6" rx="2" />
          <circle cx="40" cy="40" r="12" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-sense-text">Sony α7 IV</h1>
      <p className="mt-1 text-[13px] text-sense-muted">Full-Frame Mirrorless Camera</p>
      <div className="mt-5 font-mono">
        <span data-test="current-price" className="text-4xl font-bold text-sense-text">{price}</span>
      </div>
      <div className="mt-2">
        <span data-test="availability" className={`font-mono text-[13px] ${stockColor}`}>{stockLabel}</span>
      </div>
      <div className="mt-6 flex justify-center gap-2 font-mono text-[12px] text-sense-muted">
        <span className="rounded-full bg-sense-tertiary px-3 py-1">★ 4.8</span>
        <span className="rounded-full bg-sense-tertiary px-3 py-1">1,247 reviews</span>
      </div>
    </motion.div>
  );
}

/* ---- Template C: Schema ---- */

function TemplateC({
  price,
  stockLabel,
  stockColor,
}: {
  price: string;
  stockLabel: string;
  stockColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
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
      <div className="mb-6 aspect-[21/9] rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-8">
        <div className="flex h-full items-center justify-center">
          <svg className="h-32 w-32 text-slate-600" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="14" y="20" width="52" height="40" rx="7" />
            <rect x="26" y="13" width="28" height="7" rx="3" />
            <circle cx="40" cy="40" r="14" />
            <circle cx="40" cy="40" r="6" />
          </svg>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-sense-text">Sony A7IV</h1>
          <p className="mt-0.5 text-[13px] text-sense-muted">Full-Frame Mirrorless · SKU: ILCE-7M4</p>
        </div>
        <span className={`font-mono text-[13px] ${stockColor}`}>{stockLabel}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-2 font-mono">
        <span className="display-price text-3xl font-bold text-sense-text">{price}</span>
        <span className="text-[13px] text-sense-muted">USD</span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="font-mono text-[13px] text-sense-muted">★ 4.8 (1,247)</span>
        <span className="availability-badge font-mono text-[12px] text-sense-dim">
          {stockLabel === "In Stock" ? "Available now" : "Currently unavailable"}
        </span>
      </div>
    </motion.div>
  );
}
