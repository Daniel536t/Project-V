"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Scar {
  id: number;
  watch_id: string | null;
  collector_id: string | null;
  broke_at: string | null;
  healed_at: string | null;
  original_intent: string | null;
  old_selector: string | null;
  new_selector: string | null;
  confidence: number | null;
  recovery_seconds: number | null;
  description: string | null;
  error_message: string | null;
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ScarLog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [scars, setScars] = useState<Scar[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const r = await fetch("/api/ledger");
        const d = await r.json();
        if (Array.isArray(d.scars)) setScars(d.scars);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.25 }}
          className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-white/10 bg-sense-dark shadow-2xl"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h2 className="font-mono text-sm font-semibold text-sense-text">Scar Log</h2>
                <p className="mt-0.5 font-mono text-[11px] text-sense-dim">
                  The ledger isn&apos;t a museum. It&apos;s an immune-system log.
                </p>
              </div>
              <button onClick={onClose} className="font-mono text-sm text-sense-dim hover:text-sense-text">
                ✕
              </button>
            </div>

            <div className="sense-terminal min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {scars.length === 0 && (
                <div className="font-mono text-[12px] text-sense-dim">
                  No scars yet. Break the site to watch SENSE heal.
                </div>
              )}
              {scars.map((s) => (
                <div key={s.id} className="mb-4 rounded-lg border border-white/5 bg-sense-tertiary/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-sense-warning">
                      Scar · {s.watch_id ?? "?"}
                    </span>
                    <span className="font-mono text-[11px] text-sense-dim">
                      healed in {s.recovery_seconds ?? "?"}s · conf {s.confidence ?? "?"}%
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[11px] leading-relaxed text-sense-muted">
                    <div className="text-sense-dim">intent:</div>
                    <div className="text-sense-text">{s.original_intent ?? "—"}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="text-sense-dim">
                      old <span className="text-sense-danger">{s.old_selector ?? "—"}</span>
                    </div>
                    <div className="text-sense-dim">
                      new <span className="text-sense-success">{s.new_selector ?? "—"}</span>
                    </div>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-sense-dim">
                    {fmt(s.broke_at)} → {fmt(s.healed_at)} ·{" "}
                    <span className="text-sense-muted">{s.collector_id ?? ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
