"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
  stock_level: number;
}

const TEMPLATE_LABEL: Record<string, string> = {
  A: "Classic",
  B: "Modern",
  C: "Schema",
};

export default function BreakControls({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductState | null;
}) {
  const [price, setPrice] = useState(product?.price ?? 139);
  const [working, setWorking] = useState(false);

  if (!open || !product) return null;

  async function post(action: string, value?: unknown) {
    setWorking(true);
    try {
      const r = await fetch("/api/store/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      const d = await r.json();
      if (d.price != null) setPrice(Number(d.price));
    } catch {
      /* ignore */
    } finally {
      setWorking(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-sense-dark p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-sm font-semibold text-sense-text">
              ⚙ Break This Site
            </h2>
            <p className="mt-1 font-mono text-[11px] text-sense-dim">
              {TEMPLATE_LABEL[product.template] ?? "Classic"} template · ${product.price}
            </p>
          </div>
          <button
            onClick={onClose}
            className="sense-press flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] font-mono text-sm text-sense-dim transition hover:border-white/[0.15] hover:text-sense-text"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Redesign */}
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-sense-dim">
              Redesign Site
            </div>
            <button
              onClick={() => post("redesign")}
              disabled={working}
              className="sense-press w-full rounded-xl border border-sense-danger/40 bg-sense-danger/[0.07] px-4 py-3 font-mono text-[13px] text-sense-danger transition hover:border-sense-danger/70 hover:bg-sense-danger/[0.12] disabled:opacity-50"
            >
              Switch to {TEMPLATE_LABEL[product.template === "A" ? "B" : product.template === "B" ? "C" : "A"]}
            </button>
          </div>

          {/* Price slider */}
          <div>
            <div className="mb-2 flex items-center justify-between font-mono text-[11px]">
              <span className="uppercase tracking-[0.12em] text-sense-dim">Price</span>
              <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[13px] font-semibold text-sense-electric">
                ${price}
              </span>
            </div>
            <input
              type="range"
              min={90}
              max={220}
              step={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              onMouseUp={() => post("set_price", price)}
              onTouchEnd={() => post("set_price", price)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-sense-electric"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-sense-dim">
              <span>$90</span>
              <span>$220</span>
            </div>
          </div>

          {/* Stock toggle */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-sense-dim">
              Out of Stock
            </span>
            <button
              onClick={() => post("set_stock", !product.in_stock)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                !product.in_stock ? "bg-sense-danger/70" : "bg-white/[0.08]"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  !product.in_stock ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Stock level */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-sense-dim">
              Stock Level
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  post("set_stock_level", Math.max(0, (product.stock_level ?? 3) - 1))
                }
                disabled={working}
                className="sense-press h-7 w-7 rounded-lg border border-white/[0.08] font-mono text-sm text-sense-text transition hover:border-white/[0.2] disabled:opacity-50"
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-[13px] font-semibold text-sense-electric">
                {product.stock_level ?? 3}
              </span>
              <button
                onClick={() => post("set_stock_level", (product.stock_level ?? 3) + 1)}
                disabled={working}
                className="sense-press h-7 w-7 rounded-lg border border-white/[0.08] font-mono text-sm text-sense-text transition hover:border-white/[0.2] disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Bot detection */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-sense-dim">
              Bot Detection
            </span>
            <button
              onClick={() => post("set_bot_detection", !product.bot_detection)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                product.bot_detection ? "bg-sense-warning/70" : "bg-white/[0.08]"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  product.bot_detection ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <p className="mt-6 border-t border-white/[0.05] pt-4 font-mono text-[10px] leading-relaxed text-sense-dim">
          Everything here is real. The scraper sees what you see.
        </p>
      </motion.div>
    </motion.div>
  );
}
