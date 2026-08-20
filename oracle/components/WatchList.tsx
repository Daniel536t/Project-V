"use client";

import { useEffect, useState } from "react";

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
  last_checked_at: string | null;
  next_check_at: string | null;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeUntil(ts: string | null): string {
  if (!ts) return "due now";
  const s = Math.floor((new Date(ts).getTime() - Date.now()) / 1000);
  if (s <= 0) return "due now";
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

function statusMeta(status: string) {
  switch (status) {
    case "checking":
      return { dot: "bg-sky-400", text: "text-sky-300", label: "Checking", spin: true };
    case "alerted":
      return { dot: "bg-rose-400", text: "text-rose-300", label: "Alerted", spin: false };
    case "error":
      return { dot: "bg-amber-400", text: "text-amber-300", label: "Needs attention", spin: false };
    case "healed":
      return { dot: "bg-violet-400", text: "text-violet-300", label: "Healed", spin: false };
    default:
      return { dot: "bg-emerald-400", text: "text-emerald-300", label: "Watching", spin: false };
  }
}

export default function WatchList() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [checking, setChecking] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      const r = await fetch("/api/watches");
      const d = await r.json();
      if (Array.isArray(d.watches)) setWatches(d.watches);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, []);

  async function checkNow(id: string) {
    setChecking((s) => new Set(s).add(id));
    try {
      await fetch(`/api/watches/${id}/check`, { method: "POST" });
    } catch {
      /* ignore */
    }
    setChecking((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    refresh();
  }

  if (watches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
        <p className="text-2xl">👁️</p>
        <p className="mt-3 text-[15px] font-medium text-white/80">No watches yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-white/45">
          Tell SENSE what to watch — a price, a restock, a drop — and it will
          remember and check for you.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {watches.map((w) => {
        const m = statusMeta(w.status);
        return (
          <div
            key={w.id}
            className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05] ${
              w.status === "alerted"
                ? "sense-tingle border-rose-400/50 bg-rose-500/[0.06]"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[15px] font-medium">
                {w.label ?? w.id}
              </span>
              <span className={`flex items-center gap-1.5 text-xs ${m.text}`}>
                {m.spin ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                )}
                {m.label}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-white/40">
              {w.field} {w.operator} {w.target ?? ""} · via live search
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-white/55">
              <span>
                last{" "}
                {w.last_value
                  ? w.field === "price"
                    ? `$${w.last_value}`
                    : w.last_value
                  : "—"}{" "}
                · {timeAgo(w.last_checked_at)}
              </span>
              <span className="text-white/35">next {timeUntil(w.next_check_at)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => checkNow(w.id)}
                disabled={checking.has(w.id)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {checking.has(w.id) ? "Checking…" : "Check now"}
              </button>
              {w.scar_count > 0 && (
                <span className="text-xs text-white/35">
                  🕸️ {w.scar_count} heal{w.scar_count === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
