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
}

export default function BreakControls({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductState | null;
}) {
  const [price, setPrice] = useState(product?.price ?? 899);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-sense-dark p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-sense-text">
            ⚙ Break This Site
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-sm text-sense-dim hover:text-sense-text"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Redesign */}
          <div>
            <div className="mb-1 font-mono text-[11px] text-sense-dim">Redesign Site</div>
            <button
              onClick={() => post("redesign")}
              disabled={working}
              className="w-full rounded-lg border border-sense-danger/40 bg-sense-danger/[0.08] px-4 py-2.5 font-mono text-[13px] text-sense-danger transition hover:bg-sense-danger/[0.14] disabled:opacity-50"
            >
              Switch to template{" "}
              {product.template === "A" ? "B" : product.template === "B" ? "C" : "A"}
            </button>
          </div>

          {/* Price slider */}
          <div>
            <div className="mb-1 font-mono text-[11px] text-sense-dim">
              Price — ${price}
            </div>
            <input
              type="range"
              min={699}
              max={999}
              step={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              onMouseUp={() => post("set_price", price)}
              onTouchEnd={() => post("set_price", price)}
              className="w-full accent-sense-electric"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-sense-dim">
              <span>$699</span>
              <span>$999</span>
            </div>
          </div>

          {/* Stock toggle */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-sense-dim">Out of Stock</span>
            <button
              onClick={() => post("set_stock", !product.in_stock)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition ${
                !product.in_stock ? "bg-sense-danger" : "bg-sense-tertiary"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  !product.in_stock ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Bot detection */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-sense-dim">Bot Detection</span>
            <button
              onClick={() => post("set_bot_detection", !product.bot_detection)}
              disabled={working}
              className={`relative h-6 w-11 rounded-full transition ${
                product.bot_detection ? "bg-sense-warning" : "bg-sense-tertiary"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  product.bot_detection ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <p className="mt-5 font-mono text-[10px] leading-relaxed text-sense-dim">
          Everything here is real. The scraper sees what you see.
        </p>
      </motion.div>
    </motion.div>
  );
}
