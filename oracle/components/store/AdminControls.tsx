'use client';

import { useEffect, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import type { StoreProduct } from '@/lib/useStoreStream';

interface Props {
  state: { products: StoreProduct[]; template: string; botDetection: boolean };
}

export default function AdminControls({ state }: Props) {
  const [open, setOpen] = useState(false);
  const active = state.products.find((p) => p.livePrice != null) ?? state.products[0];
  const [price, setPrice] = useState<number>(active?.livePrice ?? active?.originalPrice ?? 999);

  // Keep the slider synced to the live price.
  useEffect(() => {
    const a = state.products.find((p) => p.livePrice != null) ?? state.products[0];
    if (a) setPrice(a.livePrice ?? a.originalPrice);
  }, [state.products]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const post = async (action: string, value?: unknown) => {
    try {
      await fetch('/api/store/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-[var(--danger)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--danger)] shadow-lg transition hover:bg-[#fff0f3]"
      >
        <Settings2 size={15} />
        Break This Site
      </button>

      {open && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[380px] rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold">Demo Controls</h3>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} className="text-[var(--gray-1)]" />
              </button>
            </div>
            <p className="mt-1 text-[12px] text-[var(--gray-1)]">
              Everything here is real — the scraper sees what you see.
            </p>

            <button
              onClick={() => post('redesign')}
              className="mt-4 w-full rounded-xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white transition hover:bg-black"
            >
              Redesign Site · template {state.template} → next
            </button>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">Price</span>
                <span className="mono font-semibold">${price}</span>
              </div>
              <input
                type="range"
                min={699}
                max={1099}
                step={10}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                onMouseUp={() => post('set_price', price)}
                onTouchEnd={() => post('set_price', price)}
                className="mt-2 w-full accent-[var(--store-blue)]"
              />
            </div>

            <div className="mt-4 space-y-2">
              <Toggle
                label="In stock"
                checked={active?.inStock ?? true}
                onChange={(v) => post('set_stock', v)}
              />
              <Toggle
                label="Bot detection (403)"
                checked={state.botDetection}
                onChange={(v) => post('set_bot_detection', v)}
              />
            </div>

            <p className="mt-4 text-center text-[11px] text-[var(--gray-2)]">
              Break it yourself — SENSE heals and keeps watching.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({
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
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] px-3.5 py-2.5 text-[13px]"
    >
      <span>{label}</span>
      <span
        className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-[var(--success)]' : 'bg-[#e5e5ea]'
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
