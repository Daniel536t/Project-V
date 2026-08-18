"use client";

import { useEffect, useState } from "react";
import HealingVisualizer from "@/components/HealingVisualizer";

const STEPS = [
  "Collector c_xxxxxxxx broke",
  "Detecting missing rows…",
  "Re-scraping era 2010-2020…",
  "Reconciling yearly_stats…",
  "Ledger updated",
];

export default function HealingDemoPage() {
  const [events, setEvents] = useState<unknown[]>([]);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    fetch("/api/heal-ledger")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, [triggered]);

  async function triggerHeal() {
    await fetch("/api/heal-ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collector_id: "c_demo",
        era: 2010,
        description: "Demo collector recovered after simulated failure",
        error_message: "simulated: rate limit",
        recovery_steps: { retry: "exponential backoff", rescrape: "2010-2020" },
        rows_recovered: 1284,
      }),
    });
    setTriggered((t) => !t);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-spider-yellow">
        THE HEALING LEDGER
      </p>
      <h1 className="mt-2 font-display text-5xl tracking-wide text-foreground">
        It heals itself.
      </h1>
      <p className="mt-3 text-foreground/60">
        When a scraper breaks, ORACLE detects the gap, re-scrapes the missing
        era, and logs proof to the ledger.
      </p>

      <div className="mt-10">
        <HealingVisualizer steps={STEPS} healed={events.length > 0} />
      </div>

      <button
        onClick={triggerHeal}
        className="mt-8 self-start rounded-xl bg-spider-red px-6 py-3 font-display text-lg tracking-wider text-white transition hover:bg-spider-pink"
      >
        SIMULATE A BREAK
      </button>

      {events.length > 0 && (
        <div className="mt-8 space-y-3">
          <p className="font-display text-xl tracking-wider text-spider-blue">
            LEDGER ENTRIES
          </p>
          {events.map((e, i) => (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl border border-foreground/10 bg-panel/80 p-4 text-xs text-foreground/70"
            >
              {JSON.stringify(e, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </main>
  );
}
