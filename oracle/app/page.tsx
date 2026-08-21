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
  stock_level: number;
}

export default function Home() {
  const [showBreak, setShowBreak] = useState(false);
  const [showScars, setShowScars] = useState(false);
  const [product, setProduct] = useState<ProductState | null>(null);
  const [scarCount, setScarCount] = useState(0);
  const [healRipple, setHealRipple] = useState(false);

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
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="sense-scope relative h-screen w-screen overflow-hidden bg-sense-black font-sans text-sense-text">
      {/* ── Ambient depth (SENSE side only — the store stays clean white) ── */}
      <div className="pointer-events-none absolute inset-0">
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
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>
      </div>

      {/* ── Two panes, yin & yang: SENSE = light chrome / dark body,
            STORE = dark chrome / white body ── */}
      <div className="relative z-10 flex h-full">
        {/* LEFT: SENSE */}
        <div className="flex w-1/2 min-w-0 flex-col border-r border-white/[0.06]">
          <SenseChat
            scarCount={scarCount}
            onOpenScars={() => setShowScars(true)}
            onHealRipple={() => setHealRipple((v) => !v)}
          />
        </div>

        {/* RIGHT: STORE + terminal strip */}
        <div className="flex w-1/2 min-w-0 flex-col">
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
