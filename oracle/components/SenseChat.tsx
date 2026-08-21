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
  last_checked_at: string | null;
  next_check_at: string | null;
}

interface Message {
  role: "user" | "agent";
  text: string;
  alert?: boolean;
  ts: number;
}

interface AlertPayload {
  watch_id: string;
  product_name: string;
  value: string;
  field: string;
  operator: string;
  target: string | null;
}

const SUGGESTIONS = [
  "Watch the Nike Dunk Low 'Panda' and alert me when it drops below $120",
  "Notify me when the Panda Dunk is back in stock",
  "What am I watching?",
];

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

function stamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SenseChat({
  scarCount,
  onOpenScars,
  onHealRipple,
}: {
  scarCount: number;
  onOpenScars: () => void;
  onHealRipple?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live clock for countdowns (ticks every second).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
            ts: Date.now(),
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

  async function checkNow(id: string) {
    try {
      await fetch(`/api/watches/${id}/scrape`, { method: "POST" });
    } catch {
      /* ignore */
    }
    refreshWatches();
  }

  async function removeWatch(id: string) {
    try {
      await fetch(`/api/watches/${id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    refreshWatches();
  }

  async function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: content, ts: Date.now() }]);
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const d = await r.json();
      setMessages((prev) => [...prev, { role: "agent", text: d.message ?? "…", ts: Date.now() }]);
      if (Array.isArray(d.watches)) setWatches(d.watches);
      if (d.events?.includes("heal")) onHealRipple?.();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "I hit a snag — try again.", ts: Date.now() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // ── derived state for the footer + cards ──
  const nextCheckTs = watches.length
    ? Math.min(
        ...watches.map((w) =>
          w.next_check_at ? new Date(w.next_check_at).getTime() : Infinity,
        ),
      )
    : null;
  const footerText =
    watches.length === 0
      ? "online · idle — tell me what to watch"
      : nextCheckTs && nextCheckTs !== Infinity
        ? `online · ${watches.length} watch${watches.length === 1 ? "" : "es"} · next check in ${Math.max(1, Math.round((nextCheckTs - now) / 1000))}s`
        : `online · ${watches.length} watch${watches.length === 1 ? "" : "es"}`;

  return (
    <div className="flex h-full flex-col">
      {/* ── Pane header — LIGHT chrome, mirror of the store's navy header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e7e9ec] bg-white px-5">
        <div className="flex items-center gap-3">
          <span className="sense-logo-light text-[21px]">
            SENSE<b>.</b>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide text-[#0083a0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4ff] shadow-[0_0_6px_#00d4ff]" />
            live
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenScars}
            className="sense-press group flex items-center gap-2 rounded-full border border-[#e7e9ec] bg-white px-3.5 py-1.5 font-mono text-[11px] text-[#565959] transition hover:border-[#ffaa00]/50 hover:text-[#0f1111]"
          >
            <span className="text-[13px] leading-none transition-transform duration-200 group-hover:-rotate-12">
              🕸
            </span>
            <span>Scars</span>
            {scarCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffaa00]/15 px-1 font-mono text-[10px] font-semibold text-[#b26a00]">
                {scarCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMessages([])}
            className="sense-press rounded-full px-3 py-1.5 font-mono text-[11px] text-[#565959] transition hover:bg-[#f3f3f3] hover:text-[#0f1111]"
          >
            Clear
          </button>
          <span className="hidden items-center gap-1.5 rounded-full border border-[#e7e9ec] bg-white px-3 py-1.5 font-mono text-[10px] text-[#8a8a8a] md:flex">
            Powered by <span className="font-medium text-[#0f1111]">Bright Data</span>
          </span>
        </div>
      </header>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="sense-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="sense-orb" />
            <div className="sense-logo mt-6 text-[34px]">SENSE</div>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-sense-muted">
              Tell me what to watch. I&apos;ll keep an eye on it, survive any
              redesign, and ping you the moment it matters.
            </p>
            <div className="mt-7 flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="sense-press rounded-full border border-sense-electric/25 bg-sense-electric/[0.06] px-3.5 py-2 text-[12px] text-sense-electric transition hover:border-sense-electric/50 hover:bg-sense-electric/[0.12]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex items-end gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "agent" && (
                <span className="mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sense-electric/25 bg-sense-electric/[0.08] text-[12px] text-sense-electric">
                  🕸
                </span>
              )}
              <div className="flex max-w-[85%] flex-col">
                <div
                  className={`whitespace-pre-line rounded-xl px-4 py-2.5 text-[14px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-sense-tertiary text-sense-text"
                      : m.alert
                        ? "sense-tingle sense-alert-ring rounded-bl-md border border-sense-danger/40 bg-sense-danger/[0.08] text-sense-text"
                        : "rounded-bl-md border-l-2 border-sense-electric bg-sense-tertiary/50 text-sense-text"
                  }`}
                >
                  {m.text}
                </div>
                <span
                  className={`mt-1 font-mono text-[10px] text-sense-dim ${m.role === "user" ? "text-right" : ""}`}
                >
                  {stamp(m.ts)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sense-electric/25 bg-sense-electric/[0.08] text-[12px] text-sense-electric">
              🕸
            </span>
            <div className="flex items-center gap-2.5 rounded-xl rounded-bl-md border-l-2 border-sense-electric bg-sense-tertiary/50 px-4 py-2.5">
              <span className="sense-dots font-mono text-[13px] text-sense-muted">
                {watches.length > 0 ? "Scraping" : "Setting up a watch"}
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Active watches ── */}
      {watches.length > 0 && (
        <div className="border-t border-white/[0.06] px-6 pb-1 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sense-dim">
              Active watches
            </span>
            <span className="font-mono text-[10px] text-sense-dim">{watches.length}</span>
          </div>
          <div className="sense-scroll -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-3">
            {watches.map((w) => {
              const lastAgo =
                w.last_checked_at == null
                  ? null
                  : Math.round((now - new Date(w.last_checked_at).getTime()) / 1000);
              const nextIn =
                w.next_check_at == null
                  ? null
                  : Math.round((new Date(w.next_check_at).getTime() - now) / 1000);
              return (
                <div
                  key={w.id}
                  className={`sense-card min-w-[236px] max-w-[252px] flex-1 shrink-0 rounded-xl p-3.5 ${
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
                    <span className="text-[16px] font-medium tracking-tight text-sense-text">
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
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2">
                    <span className="font-mono text-[10px] text-sense-dim">
                      {lastAgo != null && lastAgo < 60
                        ? `checked ${lastAgo}s ago`
                        : lastAgo != null
                          ? `checked ${Math.round(lastAgo / 60)}m ago`
                          : "never checked"}
                      {nextIn != null && w.status !== "alerted" && w.status !== "broken"
                        ? ` · next ${Math.max(1, nextIn)}s`
                        : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => checkNow(w.id)}
                        disabled={busy}
                        title="Check now"
                        className="sense-press flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] text-[10px] text-sense-muted transition hover:border-sense-electric/40 hover:text-sense-electric disabled:opacity-40"
                      >
                        ⟳
                      </button>
                      <button
                        onClick={() => removeWatch(w.id)}
                        disabled={busy}
                        title="Stop watching"
                        className="sense-press flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] text-[11px] text-sense-dim transition hover:border-sense-danger/40 hover:text-sense-danger disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="border-t border-white/[0.06] px-6 py-4">
        <div className="sense-input flex items-center gap-2 rounded-xl border border-white/[0.08] bg-sense-tertiary/50 px-4 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Watch something… e.g. 'Alert me when the Dunk drops below $120'"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-sense-text placeholder:text-sense-dim focus:outline-none"
          />
          <span className="hidden font-mono text-[10px] text-sense-dim sm:block">↵</span>
          <button
            onClick={() => submit()}
            disabled={busy || !input.trim()}
            className="sense-press rounded-lg bg-sense-electric px-3.5 py-1.5 text-[13px] font-semibold text-black shadow-[0_0_18px_-4px_rgba(0,212,255,0.6)] transition hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* ── Status footer — dark twin of the store's terminal strip ── */}
      <footer className="flex h-[34px] shrink-0 items-center gap-3 border-t border-white/[0.06] bg-[#0a0a0a] px-4">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sense-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-sense-success shadow-[0_0_6px_#00ff88]" />
          Sense core
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-sense-muted">
          {footerText}
        </span>
      </footer>
    </div>
  );
}
