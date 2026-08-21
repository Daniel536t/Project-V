"use client";

import { useEffect, useState } from "react";
import SenseChat from "@/components/SenseChat";
import StorePanel from "@/components/StorePanel";
import TerminalStrip from "@/components/TerminalStrip";
import BreakControls from "@/components/BreakControls";
import ParticleWeb from "@/components/ParticleWeb";
import ScarLog from "@/components/ScarLog";

interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
}

export default function Home() {
  const [showBreak, setShowBreak] = useState(false);
  const [showScars, setShowScars] = useState(false);
  const [product, setProduct] = useState<ProductState | null>(null);
  const [scarCount, setScarCount] = useState(0);
  const [healRipple, setHealRipple] = useState(false);

  // Load product + scar count on mount and periodically.
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/products/nike-dunk-panda");
        setProduct(await r.json());
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch("/api/ledger");
        const d = await r.json();
        setScarCount(Number(d.total) || 0);
      } catch {
        /* ignore */
      }
    };
    load();
    // SSE store stream keeps product live (StorePanel subscribes);
    // poll scar count periodically.
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="sense-scope relative h-screen w-screen overflow-hidden bg-sense-black font-sans text-sense-text">
      {/* ── Ambient depth ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Particle web behind SENSE side only */}
        <div className="absolute inset-y-0 left-0 w-1/2">
          <ParticleWeb ripple={healRipple} />
          <div
            className="absolute left-4 top-24 h-80 w-80 rounded-full bg-sense-purple sense-glow"
            style={{ opacity: 0.09 }}
          />
          <div
            className="absolute -left-10 bottom-10 h-64 w-64 rounded-full bg-sense-electric sense-glow"
            style={{ opacity: 0.05 }}
          />
          {/* Vignette for depth — SENSE side only, so the white store stays clean */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>
      </div>

      {/* ── Top bar (56px) ── */}
      <header className="relative z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-sense-black/60 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <span className="sense-logo text-[22px] leading-none">SENSE</span>
          {product && (
            <span className="flex items-center gap-1.5 rounded-full border border-sense-electric/25 bg-sense-electric/[0.07] px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide text-sense-electric">
              <span className="h-1.5 w-1.5 rounded-full bg-sense-electric shadow-[0_0_6px_#00d4ff]" />
              Live · ${product.price}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowScars(true)}
            className="sense-press group flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-sense-muted transition hover:border-sense-warning/30 hover:bg-white/[0.06] hover:text-sense-text"
          >
            <span className="text-[13px] leading-none transition-transform duration-200 group-hover:-rotate-12">
              🕸
            </span>
            <span>Scars</span>
            {scarCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sense-warning/15 px-1 font-mono text-[10px] font-semibold text-sense-warning">
                {scarCount}
              </span>
            )}
          </button>
          <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-sense-dim sm:flex">
            Powered by{" "}
            <span className="font-medium text-sense-muted">Bright Data</span>
          </span>
        </div>
      </header>

      {/* ── Split body ── */}
      <div className="flex h-[calc(100%-3.5rem)]">
        {/* LEFT: SENSE chat */}
        <div className="relative z-10 flex w-1/2 min-w-0 flex-col border-r border-white/[0.06]">
          <SenseChat onHealRipple={() => setHealRipple((v) => !v)} />
        </div>

        {/* RIGHT: STORE + terminal strip */}
        <div className="relative z-10 flex w-1/2 min-w-0 flex-col">
          <div className="relative min-h-0 flex-1">
            <StorePanel onOpenBreak={() => setShowBreak(true)} />
            <TerminalStrip />
          </div>
        </div>
      </div>

      {/* ── Break controls popup ── */}
      <BreakControls
        open={showBreak}
        onClose={() => setShowBreak(false)}
        product={product}
      />

      {/* ── Scar Log drawer ── */}
      <ScarLog open={showScars} onClose={() => setShowScars(false)} />
    </div>
  );
}
