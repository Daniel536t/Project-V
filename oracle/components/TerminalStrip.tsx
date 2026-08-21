"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LogEvent {
  ts: number;
  level: "info" | "success" | "warn" | "error";
  text: string;
}

const LEVEL_COLOR: Record<LogEvent["level"], string> = {
  info: "#00d4ff",
  success: "#00ff88",
  warn: "#ffaa00",
  error: "#ff2d55",
};

const LEVEL_ICON: Record<LogEvent["level"], string> = {
  info: "·",
  success: "✓",
  warn: "!",
  error: "✕",
};

function stamp(ts: number): string {
  const d = new Date(ts);
  return `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
}

export default function TerminalStrip() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/logs");
    es.onmessage = (e) => {
      try {
        const ev: LogEvent = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-399), ev]);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (expanded) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [logs, expanded]);

  const latest = logs[logs.length - 1];

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-10 transition-all duration-300 ease-out ${
        expanded
          ? "h-[38%] border-t border-white/[0.08] bg-[#050507]"
          : "h-[34px] border-t border-white/[0.06] bg-[#050507]/95 backdrop-blur"
      }`}
    >
      {/* Header bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="group flex h-[34px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sense-dim transition-colors group-hover:text-sense-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-sense-success shadow-[0_0_6px_#00ff88]" />
          Live collector log
        </span>
        <span className="min-w-0 flex-1 overflow-hidden font-mono text-[11px]">
          {latest ? (
            <span className="sense-marquee" style={{ color: LEVEL_COLOR[latest.level] }}>
              {stamp(latest.ts)} {latest.text} · {stamp(latest.ts)} {latest.text}
            </span>
          ) : (
            <span className="text-sense-dim">awaiting collector…</span>
          )}
        </span>
        <span
          className={`font-mono text-[11px] text-sense-dim transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-[calc(100%-34px)] overflow-hidden px-4 pb-3"
          >
            <div ref={scrollRef} className="sense-scroll sense-terminal h-full overflow-y-auto pt-1">
              {logs.length === 0 && (
                <div className="font-mono text-[12px] text-sense-dim">no log lines yet</div>
              )}
              {logs.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-2.5 whitespace-pre-wrap font-mono text-[12px] leading-[1.75]"
                >
                  <span className="shrink-0 text-sense-dim/80">{stamp(l.ts)}</span>
                  <span className="w-3 shrink-0 text-center" style={{ color: LEVEL_COLOR[l.level] }}>
                    {LEVEL_ICON[l.level]}
                  </span>
                  <span className="min-w-0 break-words text-sense-muted">{l.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
