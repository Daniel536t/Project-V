'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSenseUi } from '@/lib/SenseUiContext';

interface ScarRow {
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
}

const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ScarLogPanel() {
  const { scarOpen, setScarOpen } = useSenseUi();
  const [scars, setScars] = useState<ScarRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!scarOpen) return;
    fetch('/api/heal-ledger')
      .then((r) => r.json())
      .then((d) => {
        setScars(d.scars ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {});
  }, [scarOpen]);

  if (!scarOpen) return null;

  return (
    <>
      {/* click-outside to dismiss */}
      <div className="absolute inset-0 z-20" onClick={() => setScarOpen(false)} aria-hidden />
      <motion.aside
        initial={{ x: 380 }}
        animate={{ x: 0 }}
        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l border-[var(--line)] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Scar Log</h2>
            <p className="mt-0.5 text-[12px] text-[var(--gray-1)]">Every break SENSE survived.</p>
          </div>
          <button onClick={() => setScarOpen(false)} aria-label="Close" className="mt-0.5">
            <X size={16} className="text-[var(--gray-1)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {scars.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-[28px]">🕷</span>
              <p className="text-[13px] text-[var(--gray-1)]">No scars yet. Break the site →</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {scars.map((s, i) => {
                const n = total - i; // newest first → highest scar number
                return (
                  <div key={s.id} className="rounded-xl bg-[var(--card)] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold">🕷 Scar #{n}</span>
                      <span className="mono text-[11px] text-[var(--gray-2)]">
                        {fmtTime(s.broke_at)}
                      </span>
                    </div>

                    {s.original_intent && (
                      <p className="mt-2 text-[12.5px] leading-snug text-[var(--ink)]">
                        &ldquo;{s.original_intent}&rdquo;
                      </p>
                    )}

                    <div className="mono mt-2.5 rounded-lg bg-white px-2.5 py-2 text-[11px] leading-relaxed">
                      <span className="text-[var(--gray-2)] line-through">
                        {s.old_selector ?? '—'}
                      </span>
                      <span className="mx-1.5 text-[var(--success)]">→</span>
                      <span className="text-[var(--success)]">{s.new_selector ?? '—'}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                        healed in {s.recovery_seconds ?? '—'}s
                      </span>
                      <span className="rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                        confidence {s.confidence ?? '—'}%
                      </span>
                      {s.collector_id && (
                        <span className="mono rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                          {s.collector_id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
