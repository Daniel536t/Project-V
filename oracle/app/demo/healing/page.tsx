"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Stage = "working" | "broken" | "healing" | "healed";

export default function HealingDemo() {
  const [stage, setStage] = useState<Stage>("working");
  const [running, setRunning] = useState(false);

  const runDemo = async () => {
    if (running) return;
    setRunning(true);
    try {
      setStage("working");
      await sleep(2000);
      setStage("broken");
      await sleep(2000);
      setStage("healing");
      await sleep(3000);
      setStage("healed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-center text-5xl">Self-Healing Demo</h1>

        <div className="spider-panel mb-8">
          <h2 className="mb-4 text-2xl">The Scenario</h2>
          <p className="mb-4">
            Our scraper has been running on the same site since 2000. Watch
            what happens when the site redesigns in 2010.
          </p>

          <button
            onClick={runDemo}
            disabled={running}
            className="rounded bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {running ? "Running…" : "Run Demo"}
          </button>
        </div>

        {/* Stage 1: Working */}
        {stage === "working" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="spider-panel mb-4"
          >
            <h3 className="mb-2 text-xl text-green-600">
              ✅ 2000: Scraper Working
            </h3>
            <pre className="rounded bg-gray-100 p-4 text-sm">{`{
  "title": "Product Name",
  "price": "$99.99",
  "availability": "In Stock"
}`}</pre>
            <p className="mt-2 text-sm text-gray-600">
              Extracted 1,284 rows successfully
            </p>
          </motion.div>
        )}

        {/* Stage 2: Broken */}
        {stage === "broken" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="spider-panel glitch mb-4"
          >
            <h3 className="mb-2 text-xl text-red-600">
              ❌ 2010: Site Redesigned
            </h3>
            <pre className="rounded bg-gray-100 p-4 text-sm">{`Error: Extraction returned empty
Selector not found: .product-price`}</pre>
            <p className="mt-2 text-sm text-gray-600">0 rows extracted</p>
          </motion.div>
        )}

        {/* Stage 3: Healing */}
        {stage === "healing" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="spider-panel mb-4"
          >
            <h3 className="mb-2 text-xl text-yellow-600">
              🕸️ Healing in Progress
            </h3>
            <div className="rounded bg-gray-100 p-4">
              <code className="text-sm">
                $ bdata scraper heal c_msyks4msrzk5ngq5q &quot;The price field
                moved from span.price to div[data-test=&#39;price-value&#39;]&quot;
              </code>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="animate-spin text-2xl" aria-hidden>
                🕸️
              </div>
              <p className="text-sm text-gray-600">
                AI is rewriting the extraction logic…
              </p>
            </div>
          </motion.div>
        )}

        {/* Stage 4: Healed */}
        {stage === "healed" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="spider-panel mb-4"
          >
            <h3 className="mb-2 text-xl text-green-600">
              ✅ Healed: Same Collector ID
            </h3>
            <pre className="rounded bg-gray-100 p-4 text-sm">{`{
  "title": "Product Name",
  "price": "$99.99",
  "availability": "In Stock"
}`}</pre>
            <p className="mt-2 text-sm text-gray-600">
              1,284 rows recovered • Nothing downstream broke
            </p>
          </motion.div>
        )}

        {/* Timeline */}
        <div className="mt-8">
          <h3 className="mb-4 text-xl">25-Year Healing Log</h3>
          <div className="space-y-2">
            {[
              { year: 2000, event: "Initial deployment", status: "success" },
              { year: 2005, event: "Site moved to new CMS", status: "healed" },
              { year: 2010, event: "Complete redesign", status: "healed" },
              { year: 2015, event: "Added JavaScript rendering", status: "healed" },
              { year: 2020, event: "Moved to React", status: "healed" },
              { year: 2026, event: "Still running", status: "success" },
            ].map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 rounded bg-gray-800 p-3"
              >
                <span className="font-bold text-red-600">{log.year}</span>
                <span className="flex-1">{log.event}</span>
                <span
                  className={
                    log.status === "success" ? "text-green-500" : "text-yellow-500"
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
