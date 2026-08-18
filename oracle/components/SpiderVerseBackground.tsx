"use client";

import { motion } from "framer-motion";

/**
 * Animated multiverse backdrop:
 *   - a slow-spinning spider web (SVG)
 *   - the dimensional portal
 *   - drifting Ben-Day halftone dots
 *   - soft neon orbs
 */
export default function SpiderVerseBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Spider web (top-left) */}
      <svg
        className="absolute -left-24 -top-24 h-[36rem] w-[36rem] opacity-30"
        viewBox="0 0 400 400"
        fill="none"
      >
        <g stroke="#00d1ff" strokeWidth="1">
          {[40, 80, 120, 160, 200].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1="200"
                y1="200"
                x2={200 + Math.cos(a) * 200}
                y2={200 + Math.sin(a) * 200}
              />
            );
          })}
        </g>
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "200px 200px" }}
        >
          <path
            d="M200 200 C 220 120, 300 140, 340 220 C 300 260, 240 260, 200 200"
            stroke="#ff2ec4"
            strokeWidth="2"
          />
        </motion.g>
      </svg>

      {/* Portal (bottom-right) */}
      <div className="portal absolute -bottom-24 -right-24" />

      {/* Neon orbs */}
      <motion.div
        className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-spider-purple/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-spider-red/15 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-spider-blue/15 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Drifting halftone dots */}
      {[
        { top: "14%", left: "62%", size: 6, color: "#ff2d55" },
        { top: "30%", left: "18%", size: 9, color: "#00d1ff" },
        { top: "70%", left: "72%", size: 7, color: "#ff2ec4" },
        { top: "82%", left: "30%", size: 5, color: "#ffe14d" },
      ].map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full opacity-40"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            background: d.color,
            boxShadow: `0 0 12px ${d.color}`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{
            duration: 7 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.8,
          }}
        />
      ))}
    </div>
  );
}
