"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Stage = "working" | "broken" | "healing" | "healed";

const STAGES: Stage[] = ["working", "broken", "healing", "healed"];

const LOG = [
  { year: 2000, event: "Initial deployment", status: "success" },
  { year: 2005, event: "Site moved to new CMS", status: "healed" },
  { year: 2010, event: "Complete redesign", status: "healed" },
  { year: 2015, event: "Added JavaScript rendering", status: "healed" },
  { year: 2020, event: "Moved to React", status: "healed" },
  { year: 2026, event: "Still running", status: "success" },
];

export default function HealingDemo() {
  const [stage, setStage] = useState<Stage>("working");
  const [running, setRunning] = useState(false);

  const runDemo = async () => {
    if (running) return;
    setRunning(true);
    try {
      setStage("working");
      await sleep(1800);
      setStage("broken");
      await sleep(2200);
      setStage("healing");
      await sleep(3000);
      setStage("healed");
    } finally {
      setRunning(false);
    }
  };

  const fx: Record<Stage, string> = {
    working: "THWIP!",
    broken: "KRAK!",
    healing: "ZZZT!",
    healed: "POW!",
  };

  const fxClass: Record<Stage, string> = {
    working: "",
    broken: "",
    healing: "onomatopoeia--cyan",
    healed: "onomatopoeia--pink",
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12">
      <div className="comic-bg" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <h1 className="chromatic mb-2 text-center text-5xl">
          Self-Healing Demo
        </h1>
        <p className="mb-10 text-center font-display text-lg tracking-[0.25em] text-spider-blue">
          THE SCRAPER THAT FIXES ITSELF
        </p>

        {/* Control panel */}
        <div className="comic-panel mb-8">
          <h2 className="mb-3 text-2xl">The Scenario</h2>
          <p className="mb-5 text-sm leading-relaxed text-gray-700">
            Our scraper has been running on the same site since 2000. Watch
            what happens when the site redesigns in 2010 — and how one sentence
            heals it.
          </p>
          <button
            onClick={runDemo}
            disabled={running}
            className="comic-btn disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Running…" : "▶ Run Demo"}
          </button>

          {/* Stage progress */}
          <div className="mt-5 flex items-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full border-2 border-black ${
                    STAGES.indexOf(stage) >= i ? "bg-spider-red" : "bg-gray-300"
                  }`}
                />
                <span className="font-display text-xs tracking-wider text-gray-500">
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stage panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div
              className={`comic-panel comic-panel--tilt scanlines mb-8 ${
                stage === "broken" ? "glitch" : ""
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h3
                    className={`text-2xl ${
                      stage === "broken"
                        ? "text-spider-red"
                        : stage === "healing"
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {stage === "working" && "✅ 2000: Scraper Working"}
                    {stage === "broken" && "❌ 2010: Site Redesigned"}
                    {stage === "healing" && "🕸️ Healing in Progress"}
                    {stage === "healed" && "✅ Healed: Same Collector ID"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {stage === "working" && "Extracted 1,284 rows successfully."}
                    {stage === "broken" && "0 rows extracted — selector gone."}
                    {stage === "healing" &&
                      "AI is rewriting the extraction logic…"}
                    {stage === "healed" &&
                      "1,284 rows recovered • Nothing downstream broke."}
                  </p>
                </div>
                <span className={`onomatopoeia ${fxClass[stage]} text-3xl`}>
                  {fx[stage]}
                </span>
              </div>

              {stage === "healing" ? (
                <div className="rounded-lg bg-gray-100 p-4">
                  <code className="block break-words text-sm">
                    $ bdata scraper heal c_msyks4msrzk5ngq5q &quot;The price
                    field moved from span.price to
                    div[data-test=&#39;price-value&#39;]&quot;
                  </code>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="animate-spin text-2xl" aria-hidden>
                      🕸️
                    </div>
                    <p className="text-sm text-gray-600">
                      Re-mapping selectors…
                    </p>
                  </div>
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">{`{
  "title": "Product Name",
  "price": "$99.99",
  "availability": "In Stock"
}`}</pre>
              )}

              {stage === "broken" && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-red-50 p-4 text-sm text-red-700">{`Error: Extraction returned empty
Selector not found: .product-price`}</pre>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Timeline */}
        <div className="mt-10">
          <h3 className="mb-5 text-3xl">25-Year Healing Log</h3>
          <div className="space-y-3">
            {LOG.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 rounded-xl border-2 border-black bg-panel p-3 shadow-[4px_4px_0_#05050a]"
              >
                <span className="font-display text-xl text-spider-red">
                  {log.year}
                </span>
                <span className="flex-1 text-foreground/90">{log.event}</span>
                <span
                  className={
                    log.status === "success"
                      ? "text-green-400"
                      : "text-spider-yellow"
                  }
                >
                  {log.status === "success" ? "✅" : "🕸️"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
