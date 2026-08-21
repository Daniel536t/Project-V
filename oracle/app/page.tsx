"use client";

import { useEffect, useState } from "react";
import SenseChat from "@/components/SenseChat";
import StorePanel from "@/components/StorePanel";
import TerminalStrip from "@/components/TerminalStrip";
import BreakControls from "@/components/BreakControls";
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
  const [watchSignal, setWatchSignal] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/products/active");
        setProduct(await r.json());
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white font-sans text-[#1d1d1f]">
      <div className="flex h-full">
        {/* LEFT — SENSE (46.4%) */}
        <div className="w-[46.4%] min-w-0 border-r border-[#e7e7e9]">
          <SenseChat
            onOpenScars={() => setShowScars(true)}
            onWatchCreated={() => setWatchSignal((v) => v + 1)}
          />
        </div>

        {/* RIGHT — STORE (53.6%) + terminal strip */}
        <div className="relative min-w-0 flex-1">
          <StorePanel onOpenBreak={() => setShowBreak(true)} watchSignal={watchSignal} />
          <TerminalStrip />
        </div>
      </div>

      {/* ── Demo controls ── */}
      <BreakControls
        open={showBreak}
        onClose={() => setShowBreak(false)}
        product={product}
      />
      <ScarLog open={showScars} onClose={() => setShowScars(false)} />
    </div>
  );
}
