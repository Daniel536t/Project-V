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
  success: "✅",
  warn: "⚠",
  error: "❌",
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
      className={`absolute inset-x-0 bottom-0 z-10 border-t border-white/5 bg-[#050507] transition-all ${
        expanded ? "h-[35%]" : "h-[32px]"
      }`}
    >
      {/* Header bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex h-[32px] w-full items-center gap-3 px-4 text-left"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-sense-dim">
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
        <span className="font-mono text-[11px] text-sense-dim">{expanded ? "▾" : "▴"}</span>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100%-32px)] overflow-hidden px-4 pb-3"
          >
            <div ref={scrollRef} className="sense-terminal h-full overflow-y-auto pt-1">
              {logs.length === 0 && (
                <div className="font-mono text-[12px] text-sense-dim">no log lines yet</div>
              )}
              {logs.map((l, i) => (
                <div key={i} className="flex gap-2 whitespace-pre-wrap font-mono text-[12px] leading-[1.7]">
                  <span className="text-sense-dim">{stamp(l.ts)}</span>
                  <span style={{ color: LEVEL_COLOR[l.level] }}>{LEVEL_ICON[l.level]}</span>
                  <span className="text-sense-muted">{l.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
