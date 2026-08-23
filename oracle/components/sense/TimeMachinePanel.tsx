'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, ExternalLink } from 'lucide-react';
import { useSenseUi } from '@/lib/SenseUiContext';
import { WAYBACK_CONFIG } from '@/lib/wayback';

interface EraResult {
  era: number;
  collectorId: string;
  productName: string | null;
  price: number | null;
  inStock: boolean | null;
  timestamp: number;
}

interface EraHealRow {
  id: number;
  collector_id: string;
  era_from: number;
  era_to: number;
  product_name: string | null;
  old_selector: string | null;
  new_selector: string | null;
  confidence: number | null;
  recovery_seconds: number | null;
  attempted_heals: number | null;
  recovery_path: string | null;
  era_from_result: Record<string, unknown> | null;
  era_to_result: Record<string, unknown> | null;
  description: string | null;
}

const config = WAYBACK_CONFIG;

export default function TimeMachinePanel() {
  const { timeMachineOpen, setTimeMachineOpen } = useSenseUi();
  const [era2019, setEra2019] = useState<EraResult | null>(null);
  const [era2026, setEra2026] = useState<EraResult | null>(null);
  const [heals, setHeals] = useState<EraHealRow[]>([]);
  const [loading2019, setLoading2019] = useState(false);
  const [loading2026, setLoading2026] = useState(false);
  const [healing, setHealing] = useState(false);

  useEffect(() => {
    if (!timeMachineOpen) return;
    fetch('/api/wayback/state')
      .then((r) => r.json())
      .then((d) => setHeals(d.heals ?? []))
      .catch(() => {});
  }, [timeMachineOpen]);

  const runEraScrape = useCallback(
    async (era: 2019 | 2026) => {
      const setter = era === 2019 ? setLoading2019 : setLoading2026;
      setter(true);
      try {
        const res = await fetch('/api/wayback/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ era }),
        });
        if (!res.ok) throw new Error('scrape failed');
        const data: EraResult = await res.json();
        if (era === 2019) setEra2019(data);
        else setEra2026(data);
      } catch {
        // Terminal will show the error
      } finally {
        setter(false);
      }
    },
    [],
  );

  const runEraHeal = useCallback(async () => {
    setHealing(true);
    try {
      await fetch('/api/wayback/heal', { method: 'POST' });
      // Refresh heals list
      const res = await fetch('/api/wayback/state');
      const d = await res.json();
      setHeals(d.heals ?? []);
    } catch {
      // Terminal will show the error
    } finally {
      setHealing(false);
    }
  }, []);

  if (!timeMachineOpen) return null;

  return (
    <>
      {/* click-outside to dismiss */}
      <div className="absolute inset-0 z-20" onClick={() => setTimeMachineOpen(false)} aria-hidden />
      <motion.aside
        initial={{ x: 380 }}
        animate={{ x: 0 }}
        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l border-[var(--line)] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Time Machine</h2>
            <p className="mt-0.5 text-[12px] text-[var(--gray-1)]">
              Same product. Seven years apart. Same pipeline.
            </p>
          </div>
          <button onClick={() => setTimeMachineOpen(false)} aria-label="Close" className="mt-0.5">
            <X size={16} className="text-[var(--gray-1)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Era cards */}
          <div className="space-y-2.5">
            {/* 2019 Era Card */}
            <div className="rounded-xl bg-[var(--card)] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--gray-1)]" />
                  <span className="text-[13px] font-semibold">2019 · Wayback Machine</span>
                </div>
                <span className="mono text-[11px] text-[var(--gray-2)]">{config.retailer}</span>
              </div>
              <p className="mt-1.5 mono text-[11px] text-[var(--gray-2)] leading-relaxed truncate">
                {config.eraFromUrl}
              </p>
              <button
                onClick={() => runEraScrape(2019)}
                disabled={loading2019}
                className="mt-2.5 w-full rounded-lg bg-[var(--store-blue)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--store-blue-hover)] disabled:opacity-50 transition-colors"
              >
                {loading2019 ? 'Scraping…' : 'Run live scrape'}
              </button>
              {era2019 && (
                <div className="mt-2.5 rounded-lg bg-white p-2.5 mono text-[11px] leading-relaxed">
                  <div className="text-[var(--ink)]">{era2019.productName ?? '—'}</div>
                  <div className="mt-1">
                    <span className="text-[var(--gray-2)]">Price: </span>
                    <span className="font-semibold">${era2019.price ?? '?'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--gray-2)]">Stock: </span>
                    <span>{era2019.inStock != null ? (era2019.inStock ? 'In Stock' : 'Out of Stock') : '—'}</span>
                  </div>
                  <div className="mt-1 text-[var(--gray-2)]">
                    collector {era2019.collectorId}
                  </div>
                </div>
              )}
            </div>

            {/* 2026 Era Card */}
            <div className="rounded-xl bg-[var(--card)] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink size={14} className="text-[var(--store-blue)]" />
                  <span className="text-[13px] font-semibold">2026 · Live site</span>
                </div>
                <span className="mono text-[11px] text-[var(--gray-2)]">{config.retailer}</span>
              </div>
              <p className="mt-1.5 mono text-[11px] text-[var(--gray-2)] leading-relaxed truncate">
                {config.eraToUrl}
              </p>
              <button
                onClick={() => runEraScrape(2026)}
                disabled={loading2026}
                className="mt-2.5 w-full rounded-lg bg-[var(--store-blue)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--store-blue-hover)] disabled:opacity-50 transition-colors"
              >
                {loading2026 ? 'Scraping…' : 'Run live scrape'}
              </button>
              {era2026 && (
                <div className="mt-2.5 rounded-lg bg-white p-2.5 mono text-[11px] leading-relaxed">
                  <div className="text-[var(--ink)]">{era2026.productName ?? '—'}</div>
                  <div className="mt-1">
                    <span className="text-[var(--gray-2)]">Price: </span>
                    <span className="font-semibold">${era2026.price ?? '?'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--gray-2)]">Stock: </span>
                    <span>{era2026.inStock != null ? (era2026.inStock ? 'In Stock' : 'Out of Stock') : '—'}</span>
                  </div>
                  <div className="mt-1 text-[var(--gray-2)]">
                    collector {era2026.collectorId}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Era Heal scar */}
          {heals.length > 0 && (
            <div className="mt-4">
              <p className="px-1 pb-2 text-[12px] text-[var(--gray-2)]">Era heal record</p>
              {heals.map((h) => (
                <div
                  key={h.id}
                  className="mb-2.5 rounded-xl border border-[var(--ios-blue)]/40 bg-[var(--card)] p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold">
                      ⏱ ERA HEAL · {h.era_from} → {h.era_to}
                    </span>
                    <span className="mono text-[11px] text-[var(--gray-2)]">
                      {h.confidence ?? 0}%
                    </span>
                  </div>

                  <div className="mono mt-2.5 rounded-lg bg-white px-2.5 py-2 text-[11px] leading-relaxed">
                    <span className="text-[var(--gray-2)] line-through">
                      {h.old_selector ?? '—'}
                    </span>
                    <span className="mx-1.5 text-[var(--success)]">→</span>
                    <span className="text-[var(--success)]">{h.new_selector ?? '—'}</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                      {h.recovery_seconds ?? '—'}s
                    </span>
                    <span className="rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                      {h.attempted_heals ?? 1} attempt(s)
                    </span>
                    <span className="rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                      {h.recovery_path ?? 'local-fallback'}
                    </span>
                    <span className="mono rounded-full bg-[var(--bubble)] px-2 py-0.5 text-[10.5px]">
                      {h.collector_id}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] text-[var(--gray-1)] leading-snug">
                    {h.recovery_path === 'bright-data'
                      ? `Bright Data heal restored extraction across ${config.eraTo - config.eraFrom} years of organic redesign. Same collector, healed in ${h.recovery_seconds ?? '?'}s.`
                      : `Bright Data planner could not map organic ${config.eraFrom}→${config.eraTo} redesign. Recovered via deterministic intent-based healing.`}
                  </p>

                  {h.description && (
                    <p className="mt-1 mono text-[10.5px] text-[var(--gray-2)] leading-snug">
                      {h.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Re-run era heal button */}
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <button
              onClick={runEraHeal}
              disabled={healing}
              className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-[12px] text-[var(--gray-1)] hover:bg-[var(--bubble)] disabled:opacity-50 transition-colors"
            >
              {healing ? 'Healing… (~60-90s)' : 'Re-run the era heal live (~60-90s)'}
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--gray-2)]">
              Bright Data analyzes {config.eraFrom}→{config.eraTo} redesign · same collector ID
            </p>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
