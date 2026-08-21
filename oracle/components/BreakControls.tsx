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
  const [price, setPrice] = useState(product?.price ?? 999);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-sm rounded-[20px] border border-[#e8e8ed] bg-white p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">⚙ Break This Site</h2>
            <p className="mt-0.5 text-[11px] text-[#8e8e93]">
              {TEMPLATE_LABEL[product.template] ?? "Classic"} template · ${product.price}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e8ed] text-[14px] text-[#6e6e73] transition hover:border-[#d2d2d7] hover:text-[#1d1d1f]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Redesign */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#8e8e93]">
              Redesign Site
            </div>
            <button
              onClick={() => post("redesign")}
              disabled={working}
              className="w-full rounded-[12px] border border-[#ff2d55]/40 bg-[#ff2d55]/[0.06] px-4 py-3 text-[13px] font-medium text-[#d90429] transition hover:border-[#ff2d55]/70 hover:bg-[#ff2d55]/[0.1] disabled:opacity-50"
            >
              Switch to {TEMPLATE_LABEL[product.template === "A" ? "B" : product.template === "B" ? "C" : "A"]}
            </button>
          </div>

          {/* Price slider */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-medium uppercase tracking-[0.1em] text-[#8e8e93]">Price</span>
              <span className="rounded-[8px] bg-[#f5f5f7] px-2 py-0.5 font-mono text-[13px] font-semibold text-[#0071e3]">
                ${price}
              </span>
            </div>
            <input
              type="range"
              min={799}
              max={1299}
              step={10}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              onMouseUp={() => post("set_price", price)}
              onTouchEnd={() => post("set_price", price)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#e0e0e5] accent-[#0071e3]"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#b0b0b5]">
              <span>$799</span>
              <span>$1,299</span>
            </div>
          </div>

          {/* Stock toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8e8e93]">
              Out of Stock
            </span>
            <button
              onClick={() => post("set_stock", !product.in_stock)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                !product.in_stock ? "bg-[#ff2d55]" : "bg-[#e0e0e5]"
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
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8e8e93]">
              Stock Level
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => post("set_stock_level", Math.max(0, (product.stock_level ?? 3) - 1))}
                disabled={working}
                className="h-7 w-7 rounded-[8px] border border-[#e8e8ed] text-[15px] text-[#1d1d1f] transition hover:border-[#d2d2d7] disabled:opacity-50"
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-[13px] font-semibold text-[#0071e3]">
                {product.stock_level ?? 3}
              </span>
              <button
                onClick={() => post("set_stock_level", (product.stock_level ?? 3) + 1)}
                disabled={working}
                className="h-7 w-7 rounded-[8px] border border-[#e8e8ed] text-[15px] text-[#1d1d1f] transition hover:border-[#d2d2d7] disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Bot detection */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8e8e93]">
              Bot Detection
            </span>
            <button
              onClick={() => post("set_bot_detection", !product.bot_detection)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                product.bot_detection ? "bg-[#f5a623]" : "bg-[#e0e0e5]"
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

        <p className="mt-6 border-t border-[#f0f0f2] pt-4 text-[11px] leading-relaxed text-[#8e8e93]">
          Everything here is real. The scraper sees what you see.
        </p>
      </motion.div>
    </motion.div>
  );
}
