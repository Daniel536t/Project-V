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
          transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-white/[0.08] bg-sense-dark shadow-2xl"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-sense-text">
                  🕸 Scar Log
                  {scars.length > 0 && (
                    <span className="rounded-full bg-sense-warning/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-sense-warning">
                      {scars.length}
                    </span>
                  )}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-sense-dim">
                  The ledger isn&apos;t a museum. It&apos;s an immune-system log.
                </p>
              </div>
              <button
                onClick={onClose}
                className="sense-press flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] font-mono text-sm text-sense-dim transition hover:border-white/[0.15] hover:text-sense-text"
              >
                ✕
              </button>
            </div>

            <div className="sense-scroll sense-terminal min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {scars.length === 0 && (
                <div className="mt-16 text-center">
                  <div className="text-2xl">🕸️</div>
                  <div className="mt-3 font-mono text-[12px] leading-relaxed text-sense-dim">
                    No scars yet.
                    <br />
                    Break the site to watch SENSE heal.
                  </div>
                </div>
              )}
              {scars.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="sense-card mb-3.5 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono text-[12px] text-sense-warning">
                      <span className="text-[13px]">🕸</span> Scar · {s.watch_id ?? "?"}
                    </span>
                    <span className="font-mono text-[11px] text-sense-dim">
                      healed in{" "}
                      <span className="text-sense-success">{s.recovery_seconds ?? "?"}s</span>
                      {" · conf "}
                      <span className="text-sense-success">{s.confidence ?? "?"}%</span>
                    </span>
                  </div>

                  <div className="mt-3 font-mono text-[11px] leading-relaxed">
                    <div className="text-sense-dim">intent</div>
                    <div className="mt-0.5 text-sense-text">{s.original_intent ?? "—"}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-1.5 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-sense-dim">old</span>
                      <code className="min-w-0 flex-1 truncate rounded bg-sense-danger/[0.08] px-2 py-1 text-sense-danger">
                        {s.old_selector ?? "—"}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-sense-dim">new</span>
                      <code className="min-w-0 flex-1 truncate rounded bg-sense-success/[0.08] px-2 py-1 text-sense-success">
                        {s.new_selector ?? "—"}
                      </code>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2.5 font-mono text-[11px] text-sense-dim">
                    <span>
                      {fmt(s.broke_at)} → {fmt(s.healed_at)}
                    </span>
                    <span className="truncate pl-2 text-sense-muted/80">{s.collector_id ?? ""}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
