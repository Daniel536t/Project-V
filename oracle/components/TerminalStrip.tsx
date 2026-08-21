"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LogEvent {
  ts: number;
  level: "info" | "success" | "warn" | "error";
  text: string;
}

const LEVEL_COLOR: Record<LogEvent["level"], string> = {
  info: "#57d7ff",
  success: "#43d17a",
  warn: "#e9d85b",
  error: "#ff5f57",
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
          ? "h-[40%] border-t border-white/10 bg-[#0b0d11]"
          : "h-[34px] border-t border-white/10 bg-[#0b0d11]"
      }`}
    >
      {/* Header bar */}
      <div className="flex h-[34px] w-full items-center gap-3 px-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 font-mono text-[11px] text-white/80 transition hover:text-white"
        >
          Terminal <span className="text-[10px] text-white/40">⌄</span>
        </button>
        <span className="flex items-center gap-3 font-mono text-[13px] text-white/40">
          <span className="cursor-pointer transition hover:text-white">＋</span>
          <span className="cursor-pointer transition hover:text-white">•••</span>
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 overflow-hidden text-left font-mono text-[11px]"
        >
          {latest ? (
            <span className="sense-marquee" style={{ color: LEVEL_COLOR[latest.level] }}>
              {stamp(latest.ts)} {latest.text} · {stamp(latest.ts)} {latest.text}
            </span>
          ) : (
            <span className="text-white/30">awaiting collector…</span>
          )}
        </button>
        <span
          className={`font-mono text-[11px] text-white/40 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </div>

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
            <div className="font-mono text-[11px] leading-[1.7] text-white/30">
              brighten@MacBook-Pro ~ % <span className="text-white/70">oracle — live collector</span>
            </div>
            <div ref={scrollRef} className="sense-scroll sense-terminal h-[calc(100%-22px)] overflow-y-auto pt-1">
              {logs.length === 0 && (
                <div className="font-mono text-[12px] text-white/30">no log lines yet</div>
              )}
              {logs.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex gap-2.5 whitespace-pre-wrap font-mono text-[12px] leading-[1.75]"
                >
                  <span className="shrink-0 text-white/30">{stamp(l.ts)}</span>
                  <span className="min-w-0 break-words" style={{ color: LEVEL_COLOR[l.level] }}>
                    {l.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
