"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Watch {
  id: string;
  label: string | null;
  product_name: string | null;
  status: string;
  last_value: string | null;
  field: string;
  operator: string;
  target: string | null;
  scar_count: number;
  collector_id: string | null;
}

interface Message {
  role: "user" | "agent";
  text: string;
  alert?: boolean;
}

interface AlertPayload {
  watch_id: string;
  product_name: string;
  value: string;
  field: string;
  operator: string;
  target: string | null;
}

const SUGGESTED = "Watch the Nike Dunk Low 'Panda' and alert me when it drops below $120";

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    watching: { label: "Watching", cls: "sense-chip--watching" },
    checking: { label: "Checking", cls: "sense-chip--healing" },
    broken: { label: "Broken", cls: "sense-chip--broken" },
    healing: { label: "Healing", cls: "sense-chip--healing" },
    healed: { label: "Healed", cls: "sense-chip--healed" },
    alerted: { label: "Alerted", cls: "sense-chip--alerted" },
    error: { label: "Error", cls: "sense-chip--broken" },
  };
  const m = map[status] ?? map.watching;
  return (
    <span className={`sense-chip ${m.cls}`}>
      <span className="sense-chip__dot" />
      {m.label}
    </span>
  );
}

export default function SenseChat({
  onHealRipple,
}: {
  onHealRipple?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function refreshWatches() {
    try {
      const r = await fetch("/api/watches");
      const d = await r.json();
      if (Array.isArray(d.watches)) setWatches(d.watches);
    } catch {
      /* ignore */
    }
  }

  // SSE alerts — the tingle.
  useEffect(() => {
    refreshWatches();
    const t = setInterval(refreshWatches, 5000);

    const es = new EventSource("/api/watches/stream");
    es.onmessage = (e) => {
      try {
        const a: AlertPayload = JSON.parse(e.data);
        setNewAlertId(a.watch_id);
        const value = a.field === "price" ? `$${a.value}` : a.value;
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text: `${a.product_name} hit ${value} — condition met (${a.operator} ${a.target ?? ""}).`,
            alert: true,
          },
        ]);
        setTimeout(() => setNewAlertId(null), 1200);
        refreshWatches();
      } catch {
        /* ignore */
      }
    };

    return () => {
      clearInterval(t);
      es.close();
    };
  }, []);

  async function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: content }]);
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const d = await r.json();
      setMessages((prev) => [...prev, { role: "agent", text: d.message ?? "…" }]);
      if (Array.isArray(d.watches)) setWatches(d.watches);
      if (d.events?.includes("heal")) onHealRipple?.();
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: "I hit a snag — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="sense-scroll min-h-0 flex-1 space-y-3.5 overflow-y-auto px-6 py-6"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sense-electric/20 bg-sense-electric/[0.06]">
              <span className="text-xl">🕸️</span>
            </div>
            <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.3em] text-sense-dim">
              SENSE
            </div>
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-sense-muted">
              Tell me what to watch. I&apos;ll keep an eye on it, survive any
              redesign, and ping you the moment it matters.
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-sense-tertiary text-sense-text"
                    : m.alert
                      ? "sense-tingle sense-alert-ring rounded-bl-md border border-sense-danger/40 bg-sense-danger/[0.08] text-sense-text"
                      : "rounded-bl-md border-l-2 border-sense-electric bg-sense-tertiary/50 text-sense-text"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2.5 rounded-xl rounded-bl-md border-l-2 border-sense-electric bg-sense-tertiary/50 px-4 py-2.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-sense-electric border-t-transparent" />
              <span className="font-mono text-[12px] text-sense-muted">
                {watches.length > 0 ? "Scraping…" : "Setting up a watch…"}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Active watches */}
      {watches.length > 0 && (
        <div className="border-t border-white/[0.06] px-6 pb-1 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sense-dim">
              Active watches
            </span>
            <span className="font-mono text-[10px] text-sense-dim">
              {watches.length}
            </span>
          </div>
          <div className="sense-scroll -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-3">
            {watches.map((w) => (
              <div
                key={w.id}
                className={`sense-card min-w-[224px] max-w-[240px] flex-1 shrink-0 rounded-xl p-3.5 ${
                  newAlertId === w.id
                    ? "sense-tingle sense-alert-border border-sense-danger/40"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-sense-text">
                    {w.label ?? w.product_name ?? w.id}
                  </span>
                  <StatusChip status={w.status} />
                </div>
                <div className="mt-2 flex items-baseline justify-between font-mono">
                  <span className="text-[15px] font-medium tracking-tight text-sense-text">
                    {w.last_value ?? "—"}
                  </span>
                  <span className="text-[11px] text-sense-dim">
                    {w.operator} {w.target ?? ""}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="truncate font-mono text-[10px] text-sense-dim">
                    {w.collector_id}
                  </span>
                  {w.scar_count > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-sense-warning">
                      🕸 {w.scar_count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/[0.06] px-6 py-4">
        {messages.length === 0 && (
          <button
            onClick={() => setInput(SUGGESTED)}
            className="sense-press group mb-3 flex w-full items-center gap-2.5 rounded-xl border border-sense-electric/20 bg-sense-electric/[0.05] px-4 py-3 text-left text-[13px] text-sense-electric transition hover:border-sense-electric/40 hover:bg-sense-electric/[0.1]"
          >
            <span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">
              ⚡
            </span>
            <span className="truncate">{SUGGESTED}</span>
          </button>
        )}
        <div className="sense-input flex items-center gap-2 rounded-xl border border-white/[0.08] bg-sense-tertiary/50 px-4 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Watch something… e.g. 'Alert me when the Dunk drops below $120'"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-sense-text placeholder:text-sense-dim focus:outline-none"
          />
          <button
            onClick={() => submit()}
            disabled={busy || !input.trim()}
            className="sense-press rounded-lg bg-sense-electric px-3.5 py-1.5 text-[13px] font-semibold text-black shadow-[0_0_18px_-4px_rgba(0,212,255,0.6)] transition hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
