"use client";

import { motion } from "framer-motion";

/**
 * Multiverse backdrop with movie-referenced motifs:
 *   - a glowing organic spider web (radial + spiral) with a spider at the hub
 *   - Miles' "venom shock" electric bolts
 *   - Peter's "spider-sense" wavy rings
 *   - the dimensional portal + drifting halftone dots + neon orbs
 */
export default function SpiderVerseBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* --- Spider web (top-left) --- */}
      <svg
        className="absolute -left-32 -top-32 h-[44rem] w-[44rem]"
        viewBox="0 0 520 520"
        fill="none"
        style={{ filter: "drop-shadow(0 0 9px rgba(0, 209, 255, 0.4))" }}
      >
        <defs>
          <linearGradient id="web-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff2ec4" />
            <stop offset="55%" stopColor="#9d4edd" />
            <stop offset="100%" stopColor="#00d1ff" />
          </linearGradient>
        </defs>

        {/* Radial spokes */}
        <g stroke="url(#web-grad)" strokeWidth="1.2" opacity="0.8">
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return (
              <line
                key={i}
                x1="260"
                y1="260"
                x2={260 + Math.cos(a) * 240}
                y2={260 + Math.sin(a) * 240}
              />
            );
          })}
        </g>

        {/* Concentric rings */}
        <g stroke="url(#web-grad)" strokeWidth="1.4" opacity="0.85">
          {[50, 95, 140, 185, 230].map((r) => (
            <circle key={r} cx="260" cy="260" r={r} />
          ))}
        </g>

        {/* Spiral strand weaving between rings */}
        <motion.path
          d="M260 210 C 300 210, 320 240, 300 260 C 280 280, 230 275, 235 240 C 240 205, 300 200, 310 260"
          stroke="#ff2ec4"
          strokeWidth="2.5"
          strokeLinecap="round"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Spider at the hub */}
        <g
          fill="#05050a"
          stroke="#00d1ff"
          strokeWidth="1.5"
          style={{ filter: "drop-shadow(0 0 6px #00d1ff)" }}
        >
          <ellipse cx="260" cy="263" rx="7" ry="10" />
          <circle cx="260" cy="250" r="4.5" />
          {[
            [-1, -1],
            [1, -1],
            [-1.6, -0.4],
            [1.6, -0.4],
            [-1.6, 0.4],
            [1.6, 0.4],
            [-1, 1],
            [1, 1],
          ].map(([dx, dy], i) => (
            <line
              key={i}
              x1="260"
              y1="252"
              x2={260 + dx * 16}
              y2={252 + dy * 16}
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>

      {/* --- Venom shock: electric bolts (Miles) --- */}
      <motion.svg
        className="absolute right-[8%] top-28 h-44 w-28"
        viewBox="0 0 60 100"
        fill="none"
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 12px #ff2ec4)" }}
      >
        <path
          d="M34 2 L8 54 H30 L24 98 L52 40 H32 Z"
          fill="#ff2ec4"
          stroke="#05050a"
          strokeWidth="2"
        />
        <path
          d="M34 2 L8 54 H30 L24 98 L52 40 H32 Z"
          fill="none"
          stroke="#00d1ff"
          strokeWidth="1"
          opacity="0.7"
        />
      </motion.svg>

      <motion.svg
        className="absolute left-[10%] top-[58%] h-32 w-20"
        viewBox="0 0 60 100"
        fill="none"
        animate={{ opacity: [0.25, 0.9, 0.25] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        style={{ filter: "drop-shadow(0 0 12px #00d1ff)" }}
      >
        <path
          d="M34 2 L8 54 H30 L24 98 L52 40 H32 Z"
          fill="#00d1ff"
          stroke="#05050a"
          strokeWidth="2"
        />
      </motion.svg>

      {/* --- Spider-sense: wavy rings (Peter) --- */}
      <motion.div
        className="absolute bottom-24 right-[22%]"
        animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {[10, 22, 34, 46].map((r) => (
          <span
            key={r}
            className="absolute rounded-full border border-spider-yellow/40"
            style={{
              width: r * 2,
              height: r * 2,
              left: -r,
              top: -r,
              borderStyle: "dashed",
            }}
          />
        ))}
      </motion.div>

      {/* --- Portal (bottom-right) --- */}
      <div className="portal absolute -bottom-24 -right-24" />

      {/* --- Neon orbs --- */}
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

      {/* --- Drifting halftone dots --- */}
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
