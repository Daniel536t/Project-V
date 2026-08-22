'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

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

export default function ScarLogSlideOver() {
  const [open, setOpen] = useState(false);
  const [scars, setScars] = useState<ScarRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      fetch('/api/ledger')
        .then((r) => r.json())
        .then((d) => {
          setScars(d.scars ?? []);
          setTotal(d.total ?? 0);
        })
        .catch(() => {});
    };
    window.addEventListener('sense:open-scar-log', onOpen);
    return () => window.removeEventListener('sense:open-scar-log', onOpen);
  }, []);

  if (!open) return null;

  return (
    <motion.div
      initial={{ x: 380 }}
      animate={{ x: 0 }}
      transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
      className="absolute inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l border-[var(--line)] bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold">Scar Log</h2>
          <p className="text-[12px] text-[var(--gray-1)]">
            {total} heal{total === 1 ? '' : 's'} · the immune-system log
          </p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close">
          <X size={18} className="text-[var(--gray-1)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {scars.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-[var(--gray-1)]">
            No scars yet — nothing has broken. Break the store and watch SENSE heal itself, same
            Collector ID, zero downtime.
          </p>
        ) : (
          <div className="space-y-4">
            {scars.map((s) => (
              <div key={s.id} className="rounded-xl border border-[var(--line)] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">
                    {s.description ?? 'Healed'}
                  </span>
                  <span className="mono text-[11px] text-[var(--gray-2)]">
                    {fmtTime(s.broke_at)}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--gray-1)]">
                  {s.original_intent ?? ''}
                </p>
                <div className="mono mt-2.5 rounded-lg bg-[var(--card)] px-2.5 py-2 text-[11px] leading-relaxed">
                  <span className="text-[var(--gray-2)] line-through">{s.old_selector ?? '—'}</span>
                  <span className="mx-1.5 text-[var(--gray-2)]">→</span>
                  <span className="text-[var(--success)]">{s.new_selector ?? '—'}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--gray-1)]">
                  <span className="mono">{s.recovery_seconds ?? '—'}s recovery</span>
                  <span className="mono">{s.confidence ?? '—'}% confidence</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
