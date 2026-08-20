"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant" | "alert";
  content: string;
  id: number;
}

interface Watch {
  id: string;
  label: string | null;
  status: string;
  last_value: string | null;
  field: string;
  operator: string;
  target: string | null;
  url: string;
  scar_count: number;
}

const PRESETS = [
  { label: "PS5 under $800", text: "Watch the PS5 and tell me when it drops under $800" },
  { label: "PS5 restock", text: "Let me know the moment the PS5 is back in stock" },
  { label: "Vinyl drop", text: "Watch this vinyl and tell me when it's available" },
  { label: "Apartment", text: "Tell me when a 2-bedroom in Brooklyn goes under $3000" },
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm SENSE. Tell me what to watch and when to tingle — I'll remember it and tell you the moment it matters.",
      id: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const alertedIds = useRef<Set<string>>(new Set());
  const idRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content, id: idRef.current++ }]);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.message ?? "Done.", id: idRef.current++ },
      ]);
      if (Array.isArray(data.watches)) setWatches(data.watches);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I hit a snag — try again.", id: idRef.current++ },
      ]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/watches");
        const data = await res.json();
        if (Array.isArray(data.watches)) {
          setWatches(data.watches);
          for (const w of data.watches) {
            if (w.status === "alerted" && !alertedIds.current.has(w.id)) {
              alertedIds.current.add(w.id);
              setMessages((m) => [
                ...m,
                {
                  role: "alert",
                  content: `${w.label ?? w.id} just fired — ${
                    w.field === "price" ? `$${w.last_value}` : w.last_value
                  } ${w.operator} ${w.target ?? ""}. It survived ${
                    w.scar_count ?? 0
                  } redesign${w.scar_count === 1 ? "" : "s"} to tell you.`,
                  id: idRef.current++,
                },
              ]);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight">SENSE</span>
          <span className="hidden text-xs text-foreground/50 sm:inline">
            spider-sense for the live web
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/demo/admin"
            className="rounded-md border border-white/15 px-3 py-1.5 text-foreground/70 hover:bg-white/5"
          >
            Demo controls
          </Link>
          <Link
            href="/console"
            className="rounded-md border border-white/15 px-3 py-1.5 text-foreground/70 hover:bg-white/5"
          >
            Console →
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {m.role === "alert" ? (
                <div className="sense-tingle max-w-[85%] rounded-lg border border-spider-red/60 bg-spider-red/10 px-4 py-3 text-sm text-foreground">
                  {m.content}
                </div>
              ) : (
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-spider-blue/90 text-black"
                      : "bg-white/5 text-foreground/90"
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-white/5 px-4 py-3 text-sm text-foreground/50">
                …
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Watches strip */}
      {watches.length > 0 && (
        <div className="border-t border-white/10 px-5 py-2">
          <div className="mx-auto flex max-w-2xl flex-wrap gap-2 text-xs">
            {watches.map((w) => (
              <span
                key={w.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                  w.status === "alerted"
                    ? "border-spider-red bg-spider-red/15 text-spider-red"
                    : w.status === "broken"
                      ? "border-spider-yellow bg-spider-yellow/10 text-spider-yellow"
                      : "border-white/15 text-foreground/70"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    w.status === "alerted"
                      ? "bg-spider-red"
                      : w.status === "broken"
                        ? "bg-spider-yellow"
                        : "bg-emerald-400"
                  }`}
                />
                {w.label ?? w.id} · {w.status}
                {w.scar_count > 0 && ` · 🕸️${w.scar_count}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => send(p.text)}
                disabled={busy}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-foreground/70 hover:bg-white/5 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder='e.g. "Watch the PS5 and tell me when it drops under $800"'
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-spider-blue focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="rounded-lg bg-spider-blue px-4 py-3 text-sm font-semibold text-black hover:bg-[#5ce6ff] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
