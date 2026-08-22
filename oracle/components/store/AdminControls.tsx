'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, X } from 'lucide-react';
import { useSharedStore } from '@/lib/StoreStreamContext';
import { FEATURED_PRODUCTS } from '@/lib/store-shared';
import type { StoreProduct } from '@/lib/useStoreStream';

const TEMPLATE_LABELS: Record<string, string> = { A: 'Classic', B: 'Modern', C: 'Schema' };

export default function AdminControls() {
  const { products, template, botDetection } = useSharedStore();
  const [open, setOpen] = useState(false);

  const active: StoreProduct | undefined =
    products.find((p) => p.livePrice != null) ?? products[0];
  const original = active?.originalPrice ?? 999;
  const live = active?.livePrice ?? original;

  const [price, setPrice] = useState<number>(live);

  // Keep the slider synced when the live price / active product changes.
  useEffect(() => {
    setPrice(active?.livePrice ?? active?.originalPrice ?? 999);
  }, [active?.id, active?.livePrice, active?.originalPrice]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const post = (body: Record<string, unknown>) =>
    fetch('/api/store/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});

  const delta = live - original;
  const deltaLabel =
    delta === 0 ? null : `${delta < 0 ? '−' : '+'}$${Math.abs(delta).toFixed(0)}`;

  return (
    <>
      {/* Floating button — dark, inviting, subtle red ping every ~4s */}
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#1d1d1f] py-2.5 pl-3.5 pr-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <span className="relative">
          <Wrench size={14} />
          <motion.span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--alert)]"
            animate={{ scale: [1, 1.7, 1], opacity: [0.9, 0, 0.9] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          />
        </span>
        <span className="text-[13px] font-medium">Break This Site</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-[380px] rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">Demo Controls</h3>
                <p className="mt-0.5 text-[11px] text-[var(--gray-2)]">
                  You&apos;re controlling the store SENSE is watching.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} className="text-[var(--gray-1)]" />
              </button>
            </div>

            {/* 1 — Product */}
            <label className="mt-5 block text-[12px] text-[var(--gray-1)]">Product</label>
            <select
              value={active?.id ?? ''}
              onChange={(e) => post({ action: 'select_product', productId: e.target.value })}
              className="mt-1.5 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--sidebar)] px-3 text-[13.5px] outline-none"
            >
              {FEATURED_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceLabel}
                </option>
              ))}
            </select>

            {/* 2 — Redesign */}
            <label className="mt-4 block text-[12px] text-[var(--gray-1)]">
              Site design (breaks the scraper)
            </label>
            <div className="mt-1.5 flex rounded-lg bg-[var(--bubble)] p-[3px]">
              {['A', 'B', 'C'].map((t) => (
                <button
                  key={t}
                  onClick={() => post({ action: 'redesign', template: t })}
                  className={`h-8 flex-1 rounded-md text-[13px] transition-colors ${
                    template === t ? 'bg-white font-medium shadow-sm' : 'text-[var(--gray-1)]'
                  }`}
                >
                  {TEMPLATE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* 3 — Price */}
            <div className="mt-4 flex items-center justify-between">
              <label className="text-[12px] text-[var(--gray-1)]">Price</label>
              <div className="flex items-center gap-2">
                <span className="mono text-[14px] font-semibold">${live.toFixed(0)}</span>
                {deltaLabel && (
                  <span
                    className={`mono rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      delta < 0 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                    }`}
                  >
                    {deltaLabel}
                  </span>
                )}
              </div>
            </div>
            <input
              type="range"
              min={Math.max(10, original - 300)}
              max={original + 100}
              step={10}
              value={Math.min(Math.max(price, 10), original + 100)}
              onChange={(e) => setPrice(Number(e.target.value))}
              onPointerUp={() => post({ action: 'set_price', price })}
              onKeyUp={() => post({ action: 'set_price', price })}
              className="mt-2 w-full accent-[var(--store-blue)]"
            />

            {/* 4 & 5 — toggles */}
            <div className="mt-4 space-y-2.5">
              <Switch
                label="Out of stock"
                checked={active ? active.inStock === false : false}
                onChange={(v) => post({ action: 'set_stock', value: !v })}
              />
              <div>
                <Switch
                  label="Bot detection (403)"
                  checked={botDetection}
                  onChange={(v) => post({ action: 'set_bot_detection', value: v })}
                />
                <p className="mt-1 pl-0.5 text-[11px] text-[var(--gray-2)]">
                  Store returns 403 + challenge page to non-browser agents.
                </p>
              </div>
            </div>

            <p className="mt-4 border-t border-[var(--line)] pt-3 text-center text-[11px] text-[var(--gray-2)]">
              No simulations. The scraper reads exactly what you see.
            </p>
          </motion.div>
        </div>
      )}
    </>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between"
    >
      <span className="text-[13.5px]">{label}</span>
      <span
        className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-[#34c759]' : 'bg-[#e5e5ea]'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}
