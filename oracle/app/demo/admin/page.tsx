"use client";

import { useEffect, useState } from "react";

interface DemoState {
  product: { name: string; price: number; inStock: boolean };
  template: number;
  botDetection: boolean;
  hits: number;
}

const btn =
  "rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition";

export default function DemoAdmin() {
  const [state, setState] = useState<DemoState | null>(null);

  async function load() {
    const r = await fetch("/api/demo");
    setState(await r.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setState(await r.json());
  }

  if (!state) {
    return <div className="p-8 font-sans text-white">Loading…</div>;
  }

  return (
    <main className="min-h-screen bg-background p-8 font-sans text-foreground">
      <div className="mx-auto max-w-md">
        <p className="text-2xl font-semibold">Demo controls</p>
        <p className="mt-1 text-sm text-foreground/50">
          Break it on purpose. SENSE heals on the next scrape.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button className={btn} onClick={() => post({ template: (state.template + 1) % 3 })}>
            🔁 Redesign page → template {(state.template + 1) % 3}
          </button>
          <button className={btn} onClick={() => post({ price: 799 })}>
            💸 Drop price → $799
          </button>
          <button className={btn} onClick={() => post({ price: 899 })}>
            📈 Raise price → $899
          </button>
          <button className={btn} onClick={() => post({ inStock: !state.product.inStock })}>
            📦 Toggle stock ({state.product.inStock ? "in stock" : "out of stock"})
          </button>
          <button className={btn} onClick={() => post({ botDetection: !state.botDetection })}>
            🤖 Bot detection: {state.botDetection ? "ON" : "OFF"}
          </button>
          <button className={btn} onClick={() => post({ reset: true })}>
            ♻️ Reset demo
          </button>
        </div>

        <p className="mt-6 text-xs text-foreground/50">
          Then ask the agent to{" "}
          <span className="text-foreground/80">“check on the PS5”</span> — it
          will scrape, heal if the selector broke, and alert if the condition
          is met.
        </p>

        <div className="mt-6 flex gap-3">
          <a className={btn} href="/demo/target">
            View target page
          </a>
          <a className={btn} href="/">
            Back to SENSE
          </a>
        </div>

        <pre className="mt-8 overflow-auto rounded-lg bg-white/5 p-4 text-xs text-foreground/50">
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>
    </main>
  );
}
