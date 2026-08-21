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
        const r = await fetch("/api/products/sony-a7iv");
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
      {/* Particle web behind SENSE side only */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2">
        <div className="absolute inset-0">
          <ParticleWeb ripple={healRipple} />
        </div>
        {/* Ambient glow */}
        <div
          className="absolute left-4 top-20 h-72 w-72 bg-sense-purple sense-glow"
          style={{ opacity: 0.08 }}
        />
      </div>

      {/* ── Top bar (56px) ── */}
      <header className="relative z-20 flex h-14 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl leading-none tracking-[0.05em] text-sense-electric">
            SENSE
          </span>
          {product && (
            <span className="flex items-center gap-1.5 rounded-full border border-sense-electric/30 bg-sense-electric/[0.06] px-2.5 py-0.5 font-mono text-[10px] text-sense-electric">
              <span className="h-1.5 w-1.5 rounded-full bg-sense-electric" />
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScars(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-sense-tertiary/60 px-3 py-1 font-mono text-[11px] text-sense-muted transition hover:border-white/20"
          >
            🕸 Scars
            {scarCount > 0 && (
              <span className="font-mono text-[11px] text-sense-warning">{scarCount}</span>
            )}
          </button>
          <span className="rounded-full border border-white/5 bg-sense-tertiary/40 px-3 py-1 font-mono text-[10px] text-sense-dim">
            Powered by Bright Data
          </span>
        </div>
      </header>

      {/* ── Split body ── */}
      <div className="flex h-[calc(100%-3.5rem)]">
        {/* LEFT: SENSE chat */}
        <div className="relative z-10 flex w-1/2 flex-col border-r border-white/5">
          <SenseChat onHealRipple={() => setHealRipple((v) => !v)} />
        </div>

        {/* RIGHT: STORE + terminal strip */}
        <div className="relative z-10 flex w-1/2 flex-col">
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
