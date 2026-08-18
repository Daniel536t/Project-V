"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HealingVisualizerProps {
  /** Steps of a healing event, shown one after another. */
  steps: string[];
  healed?: boolean;
}

/** Glitch effect that visualizes the self-healing ledger recovering data. */
export default function HealingVisualizer({
  steps,
  healed = true,
}: HealingVisualizerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % steps.length),
      1200,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  const active = steps[index] ?? "Awaiting signal…";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-spider-purple/40 bg-panel/80 p-6">
      <motion.div
        key={index}
        initial={{ opacity: 0, x: 20, skewX: -4 }}
        animate={{ opacity: 1, x: 0, skewX: 0 }}
        transition={{ duration: 0.4 }}
        className="glitch font-display text-2xl tracking-wider text-foreground"
        data-text={active}
      >
        {active}
      </motion.div>

      <div className="mt-4 flex gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-spider-red" : "bg-foreground/15"
            }`}
          />
        ))}
      </div>

      {healed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4 font-display text-lg tracking-wider text-spider-blue"
        >
          ✦ SELF-HEALED
        </motion.p>
      )}
    </div>
  );
}
