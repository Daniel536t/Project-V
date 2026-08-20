"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WatchList from "@/components/WatchList";

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

interface MediaItem {
  era: number | null;
  title: string;
  image_url: string;
  article_url: string;
  source: string;
  domain: string;
}

interface ArticleItem {
  title: string;
  url: string;
  description: string;
  domain: string;
}

interface Findings {
  query: string;
  images: MediaItem[];
  articles: ArticleItem[];
  source: string;
}

const SUGGESTIONS = [
  "Watch the PS5 and tell me when it drops under $800",
  "Let me know the moment this vinyl is back in stock",
  "PS5 price history",
  "Rarest retro video games",
];

const SOURCE_LABEL: Record<string, string> = {
  brightdata: "Bright Data",
  db: "Scraped archive",
  commons: "Wikimedia",
  demo: "Demo",
};

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="100%" height="100%" fill="#12121f"/></svg>`,
  );

export default function Home() {
  const [tab, setTab] = useState<"home" | "watches">("home");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [finding, setFinding] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const seenAlerts = useRef<Set<string>>(new Set());

  async function loadFindings(q: string) {
    setFinding(true);
    try {
      const r = await fetch(`/api/media?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setFindings({
        query: q,
        images: d.images ?? [],
        articles: d.articles ?? [],
        source: d.source ?? "",
      });
    } catch {
      setFindings(null);
    } finally {
      setFinding(false);
    }
  }

  async function submit(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setReply(null);
    setFindings(null);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      setReply(data.message ?? "");
      if (Array.isArray(data.watches)) setWatches(data.watches);
      await loadFindings(data.query ?? content);
    } catch {
      setReply("I hit a snag — try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/watches")
      .then((r) => r.json())
      .then((d) => setWatches(d.watches ?? []))
      .catch(() => {});
  }, []);

  // Poll for alerts — the tingle.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/watches");
        const d = await r.json();
        if (Array.isArray(d.watches)) {
          setWatches(d.watches);
          for (const w of d.watches) {
            if (w.status === "alerted" && !seenAlerts.current.has(w.id)) {
              seenAlerts.current.add(w.id);
              setAlert(
                `${w.label ?? w.id} just fired — ${
                  w.field === "price" ? `$${w.last_value}` : w.last_value
                } ${w.operator} ${w.target ?? ""}.`,
              );
            }
          }
        }
      } catch {
        /* ignore */
      }
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const tabBtn = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
      active ? "text-white" : "text-white/40 hover:text-white/70"
    }`;

  return (
    <div className="relative min-h-screen bg-[#07070b] font-sans text-white">
      <div className="aurora" />

      {/* Alert toast */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 top-5 z-50 -translate-x-1/2 px-4"
          >
            <div className="sense-tingle flex items-center gap-3 rounded-xl border border-rose-400/40 bg-[#1a0f14]/90 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur">
              <span>🔔</span>
              <span>{alert}</span>
              <button
                onClick={() => setAlert(null)}
                className="ml-1 text-rose-300/70 hover:text-rose-100"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#a78bfa] to-[#4cc9f0]" />
          <span className="text-[15px] font-semibold tracking-tight">SENSE</span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/50">
          Powered by Bright Data
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-32">
        {tab === "home" ? (
          <>
            {/* Hero */}
            <section className="pt-10 text-center sm:pt-16">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                  Spider-sense for the live web
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                  Tell it what to <span className="gradient-text">watch.</span>
                </h1>
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/50">
                  Track a price, a restock, a drop. SENSE checks it for you,
                  survives redesigns, and pings you the moment it matters.
                </p>
              </motion.div>

              {/* Input */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="mt-10"
              >
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 pl-5 shadow-[0_24px_60px_-24px_rgba(124,92,255,0.4)] backdrop-blur-xl transition focus-within:border-[#a78bfa]/50 focus-within:ring-1 focus-within:ring-[#a78bfa]/40">
                  <svg
                    className="h-5 w-5 shrink-0 text-white/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder='Track a price, a restock, a drop — try "PS5 under $800"'
                    className="flex-1 bg-transparent py-2 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
                  />
                  <button
                    onClick={() => submit()}
                    disabled={busy || !input.trim()}
                    className="rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#4cc9f0] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "…" : "Go"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      disabled={busy}
                      className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            </section>

            {/* Reply */}
            <AnimatePresence>
              {reply && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8"
                >
                  <div className="whitespace-pre-line rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-[15px] leading-relaxed text-white/85">
                    {reply}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Findings */}
            {finding && (
              <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>
            )}

            {!finding && findings && findings.images.length > 0 && (
              <section className="mt-14">
                <div className="mb-5 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Findings
                    </h2>
                    <p className="mt-0.5 text-sm text-white/45">
                      “{findings.query}” ·{" "}
                      {SOURCE_LABEL[findings.source] ?? findings.source}
                    </p>
                  </div>
                  <span className="text-xs text-white/35">
                    {findings.images.length} images
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {findings.images.map((it, i) => (
                    <motion.a
                      key={`${it.image_url}-${i}`}
                      href={it.article_url}
                      target="_blank"
                      rel="noreferrer"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.4 }}
                      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.image_url}
                        alt={it.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = PLACEHOLDER;
                        }}
                        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur">
                        {it.domain || "source"}
                      </span>
                      <span className="absolute inset-x-3 bottom-2.5 translate-y-2 truncate text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        {it.title}
                      </span>
                    </motion.a>
                  ))}
                </div>

                {findings.articles.length > 0 && (
                  <div className="mt-8 space-y-2">
                    {findings.articles.slice(0, 6).map((a, i) => (
                      <motion.a
                        key={`${a.url}-${i}`}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.03 }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.05]"
                      >
                        <span className="truncate text-sm text-white/85">
                          {a.title}
                        </span>
                        <span className="shrink-0 text-xs text-white/40">
                          {a.domain}
                        </span>
                      </motion.a>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="pt-8">
            <p className="text-2xl font-semibold tracking-tight">Your watches</p>
            <p className="mt-1 text-sm text-white/45">
              SENSE checks each one on a schedule and pings you when it fires.
            </p>
            <div className="mt-6">
              <WatchList />
            </div>
          </section>
        )}
      </main>

      {/* Bottom tab bar (mobile app shell) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0a12]/85 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md">
          <button className={tabBtn(tab === "home")} onClick={() => setTab("home")}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
            Home
          </button>
          <button className={tabBtn(tab === "watches")} onClick={() => setTab("watches")}>
            <div className="relative">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {watches.length > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7c5cff] px-1 text-[10px] font-semibold text-white">
                  {watches.length}
                </span>
              )}
            </div>
            Watches
          </button>
        </div>
      </nav>
    </div>
  );
}
