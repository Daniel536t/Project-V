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

const STATUS_META: Record<string, { label: string; color: string }> = {
  watching: { label: "Watching", color: "#0071e3" },
  checking: { label: "Checking", color: "#f5a623" },
  broken: { label: "Broken", color: "#ff2d55" },
  healing: { label: "Healing", color: "#f5a623" },
  healed: { label: "Healed", color: "#007a3d" },
  alerted: { label: "Alerted", color: "#ff2d55" },
  error: { label: "Error", color: "#ff2d55" },
};

const QUICK_CARDS = [
  { icon: "⚡", title: "Watch a product", sub: "alert me when it drops" },
  { icon: "🔔", title: "Watch for restock", sub: "notify me in stock" },
  { icon: "🕸", title: "Check my watches", sub: "what am I watching?" },
  { icon: "📊", title: "Scar log", sub: "show heal history" },
];

const HOME = "home";

function stamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SenseChat({
  onOpenScars,
  onHealRipple,
  onWatchCreated,
}: {
  onOpenScars: () => void;
  onHealRipple?: () => void;
  onWatchCreated?: () => void;
}) {
  // Each watch is its own conversation thread, keyed by watch id. "home" is
  // the new-chat / welcome thread.
  const [threads, setThreads] = useState<Record<string, Message[]>>({ [HOME]: [] });
  const [activeId, setActiveId] = useState<string>(HOME);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [threads, activeId]);

  const activeMessages = threads[activeId] ?? [];
  const activeWatch = watches.find((w) => w.id === activeId) ?? null;

  function appendTo(id: string, msg: Message) {
    setThreads((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), msg] }));
  }

  async function refreshWatches() {
    try {
      const r = await fetch("/api/watches");
      const d = await r.json();
      if (Array.isArray(d.watches)) setWatches(d.watches);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshWatches();
    const t = setInterval(refreshWatches, 5000);

    const es = new EventSource("/api/watches/stream");
    es.onmessage = (e) => {
      try {
        const a: AlertPayload = JSON.parse(e.data);
        setNewAlertId(a.watch_id);
        const value = a.field === "price" ? `$${a.value}` : a.value;
        appendTo(a.watch_id, {
          role: "agent",
          text: `${a.product_name} hit ${value} — condition met (${a.operator} ${a.target ?? ""}).`,
          alert: true,
          ts: Date.now(),
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick-watch events from the storefront (Watch buttons on product cards).
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { message?: string; watches?: Watch[]; watch?: { id: string; product_name?: string | null } }
        | undefined;
      if (d?.watch?.id) {
        const id = d.watch.id;
        if (d.watch.product_name) {
          appendTo(id, { role: "user", text: `Watch ${d.watch.product_name}`, ts: Date.now() });
        }
        if (d.message) appendTo(id, { role: "agent", text: d.message, ts: Date.now() });
        setActiveId(id);
      }
      if (Array.isArray(d?.watches)) setWatches(d.watches);
    };
    window.addEventListener("sense:watch-created", handler);
    return () => window.removeEventListener("sense:watch-created", handler);
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
    if (activeId === id) setActiveId(HOME);
    refreshWatches();
  }

  function newChat() {
    setThreads((prev) => ({ ...prev, [HOME]: [] }));
    setActiveId(HOME);
  }

  async function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const fromId = activeId;
    const userMsg: Message = { role: "user", text: content, ts: Date.now() };
    appendTo(fromId, userMsg);

    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const d = await r.json();
      const agentMsg: Message = { role: "agent", text: d.message ?? "…", ts: Date.now() };

      if (d.action === "create" && d.watch) {
        // The watch becomes its own thread; move the user message + reply into it.
        const id = d.watch.id;
        setThreads((prev) => {
          const next = { ...prev };
          next[fromId] = (next[fromId] ?? []).filter((m) => m !== userMsg);
          next[id] = [userMsg, agentMsg];
          return next;
        });
        setActiveId(id);
      } else {
        appendTo(fromId, agentMsg);
      }

      if (Array.isArray(d.watches)) setWatches(d.watches);
      if (d.events?.includes("heal")) onHealRipple?.();
      if (d.action === "create") onWatchCreated?.();
    } catch {
      appendTo(fromId, { role: "agent", text: "I hit a snag — try again.", ts: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  function quickCard(i: number) {
    if (i === 0) submit("Watch the iPhone 15 Pro and alert me when it drops below $949");
    else if (i === 1) submit("Notify me when the iPhone 15 Pro is back in stock");
    else if (i === 2) submit("What am I watching?");
    else onOpenScars();
  }

  return (
    <div className="flex h-full bg-white text-[#1d1d1f]">
      {/* ── Sidebar ── */}
      <aside className="flex w-[32%] min-w-[210px] flex-col border-r border-[#e7e7e9] bg-[#f8f8f9] p-4">
        <div className="flex items-center gap-2 px-1">
          <span className="tl-dot tl-red" />
          <span className="tl-dot tl-yellow" />
          <span className="tl-dot tl-green" />
        </div>

        <div className="mt-5 flex items-center gap-2.5 px-1">
          <span className="ai-spark flex h-6 w-6 items-center justify-center rounded-[6px] text-[13px]">
            ✦
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-[16px] font-semibold">
              SENSE <span className="text-[13px] text-[#8e8e93]">⌄</span>
            </div>
            <div className="text-[10px] text-[#8e8e93]">by Bright Data</div>
          </div>
        </div>

        <button
          onClick={newChat}
          className="mt-5 flex items-center justify-between rounded-[10px] bg-[#eef1f5] px-3 py-2.5 text-[14px] font-medium text-[#0071e3] transition hover:bg-[#e6eaf0]"
        >
          <span className="flex items-center gap-2">
            <span className="text-[16px] leading-none">+</span> New Chat
          </span>
          <span className="text-[15px]">↗</span>
        </button>

        <div className="mt-5 px-1 text-[13px] text-[#6d6d72]">Chats</div>
        <div className="mt-1 flex flex-col gap-0.5">
          {watches.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-[#b0b0b5]">No watches yet</div>
          ) : (
            watches.map((w) => (
              <div
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2 transition ${
                  activeId === w.id ? "bg-[#e8e8ec]" : "hover:bg-[#e8e8ec]"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-white text-[12px] text-[#0071e3]">
                  💬
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-[#1d1d1f]">
                    {w.label ?? w.product_name ?? w.id}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6e6e73]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: STATUS_META[w.status]?.color ?? "#0071e3" }}
                    />
                    {w.status}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWatch(w.id);
                  }}
                  className="opacity-0 transition group-hover:opacity-100"
                  title="Stop"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mx-1 my-4 h-px bg-[#e5e5e7]" />

        <div className="px-1 text-[13px] text-[#6d6d72]">Tools</div>
        <div className="mt-1 flex flex-col">
          {[
            { icon: "▣", label: "Templates" },
            { icon: "▤", label: "Knowledge" },
            { icon: "⚙", label: "Settings" },
          ].map((t) => (
            <button
              key={t.label}
              className="flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[13px] text-[#1d1d1f] transition hover:bg-[#e8e8ec]"
            >
              <span className="w-4 text-center text-[14px] text-[#6e6e73]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2.5 rounded-[10px] border border-[#e2e2e5] bg-white p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#eee] to-[#c9c9c9] text-[16px]">
            👤
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-[#1d1d1f]">Daniel Brighten</div>
            <div className="text-[10px] text-[#6e6e73]">Pro Plan</div>
          </div>
        </div>
      </aside>

      {/* ── Conversation ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#e7e7e9] px-5">
          <div className="flex items-center gap-2 text-[16px] font-semibold">
            {activeId === HOME ? (
              <>
                SENSE <span className="text-[13px] text-[#8e8e93]">⌄</span>
              </>
            ) : (
              <span className="max-w-[260px] truncate text-[14px]">
                {activeWatch?.label ?? activeWatch?.product_name ?? activeId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[#6e6e73]">
            <span className="cursor-pointer transition hover:text-[#1d1d1f]">↗</span>
            <span className="cursor-pointer transition hover:text-[#1d1d1f]">•••</span>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="sense-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6"
        >
          {activeId === HOME && activeMessages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="ai-spark ai-spark-ring flex h-16 w-16 items-center justify-center rounded-[16px]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                  <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                </svg>
              </div>
              <h1 className="mt-6 text-[28px] font-bold tracking-[-0.6px]">
                Hi Daniel! How can I help you today?
              </h1>
              <div className="mt-1 text-[15px] text-[#6e6e73]">
                I watch pages and tell you the moment they change.
              </div>

              <div className="mt-7 grid w-full max-w-[400px] grid-cols-2 gap-2.5">
                {QUICK_CARDS.map((c, i) => (
                  <button
                    key={c.title}
                    onClick={() => quickCard(i)}
                    className="flex min-h-[60px] items-center gap-3 rounded-[12px] border border-[#e2e2e5] bg-white px-3.5 py-3 text-left transition hover:border-[#0071e3]/40 hover:shadow-sm"
                  >
                    <span className="text-[18px] leading-none">{c.icon}</span>
                    <span>
                      <span className="block text-[12px] font-semibold text-[#1d1d1f]">{c.title}</span>
                      <span className="mt-0.5 block text-[11px] text-[#6e6e73]">{c.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeId !== HOME && activeMessages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="ai-spark flex h-12 w-12 items-center justify-center rounded-[12px]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                </svg>
              </div>
              <div className="mt-4 text-[15px] font-semibold text-[#1d1d1f]">
                {activeWatch?.label ?? activeWatch?.product_name ?? "Watching"}
              </div>
              <div className="mt-1 text-[13px] text-[#6e6e73]">
                {activeWatch?.last_value ? `Currently ${activeWatch.last_value}. ` : ""}
                I&apos;ll message you here the moment it changes.
              </div>
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {activeMessages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`flex items-end gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "agent" && (
                    <span className="ai-spark mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                      </svg>
                    </span>
                  )}
                  <div className="flex max-w-[82%] flex-col">
                    <div
                      className={`whitespace-pre-line px-4 py-2.5 text-[14px] leading-relaxed ${
                        m.role === "user"
                          ? "rounded-[16px] rounded-br-[4px] bg-[#1478f5] text-white"
                          : m.alert
                            ? "sense-tingle rounded-[14px] rounded-bl-[4px] border border-[#ff2d55]/50 bg-[#fff0f3] text-[#1d1d1f]"
                            : "rounded-[14px] rounded-bl-[4px] bg-[#f2f2f2] text-[#1d1d1f]"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.role === "agent" && !m.alert && (
                      <div className="mt-1.5 flex items-center gap-4 px-1 text-[13px] text-[#8e8e93]">
                        <span className="cursor-pointer transition hover:text-[#1d1d1f]">▢</span>
                        <span className="cursor-pointer transition hover:text-[#1d1d1f]">♡</span>
                        <span className="cursor-pointer transition hover:text-[#1d1d1f]">♧</span>
                      </div>
                    )}
                    <span className={`mt-1 px-1 font-mono text-[10px] text-[#b0b0b5] ${m.role === "user" ? "text-right" : ""}`}>
                      {stamp(m.ts)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2.5">
                <span className="ai-spark flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                  </svg>
                </span>
                <div className="flex items-center gap-1.5 rounded-[14px] rounded-bl-[4px] bg-[#f2f2f2] px-4 py-2.5 text-[13px] text-[#6e6e73]">
                  {watches.length > 0 ? "Scraping" : "Setting up a watch"}
                  <span className="sense-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Active watches (compact) ── */}
        {watches.length > 0 && (
          <div className="border-t border-[#e7e7e9] px-6 pb-2 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8e8e93]">
                Active watches
              </span>
              <span className="font-mono text-[10px] text-[#8e8e93]">{watches.length}</span>
            </div>
            <div className="sense-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
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
                    onClick={() => setActiveId(w.id)}
                    className={`min-w-[224px] max-w-[240px] shrink-0 cursor-pointer rounded-[12px] border bg-white p-3 transition ${
                      newAlertId === w.id
                        ? "sense-tingle border-[#ff2d55]/60"
                        : activeId === w.id
                          ? "border-[#0071e3]/50"
                          : "border-[#e5e5e7]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold text-[#1d1d1f]">
                        {w.label ?? w.product_name ?? w.id}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium" style={{ color: STATUS_META[w.status]?.color ?? "#0071e3" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[w.status]?.color ?? "#0071e3" }} />
                        {STATUS_META[w.status]?.label ?? w.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono">
                      <span className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">
                        {w.last_value ?? "—"}
                      </span>
                      <span className="text-[11px] text-[#8e8e93]">
                        {w.operator} {w.target ?? ""}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="truncate font-mono text-[10px] text-[#b0b0b5]">{w.collector_id}</span>
                      {w.scar_count > 0 && (
                        <span className="font-mono text-[10px] text-[#f5a623]">🕸 {w.scar_count}</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[#f0f0f2] pt-1.5">
                      <span className="font-mono text-[10px] text-[#8e8e93]">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            checkNow(w.id);
                          }}
                          disabled={busy}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[#e5e5e7] text-[11px] text-[#6e6e73] transition hover:border-[#0071e3]/50 hover:text-[#0071e3] disabled:opacity-40"
                        >
                          ⟳
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWatch(w.id);
                          }}
                          disabled={busy}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[#e5e5e7] text-[11px] text-[#8e8e93] transition hover:border-[#ff2d55]/50 hover:text-[#ff2d55] disabled:opacity-40"
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

        {/* ── Composer ── */}
        <div className="border-t border-[#e7e7e9] px-6 py-4">
          <div className="flex min-h-[52px] items-center gap-2 rounded-[20px] border border-[#dddfe3] bg-white px-4 shadow-[0_2px_7px_rgba(0,0,0,0.04)] focus-within:border-[#0071e3]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Message SENSE… e.g. 'Alert me when the iPhone drops below $949'"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1d1d1f] placeholder:text-[#8e8e93] focus:outline-none"
            />
            <button
              onClick={() => submit()}
              disabled={busy || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white transition hover:bg-[#0077ed] disabled:opacity-30"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
