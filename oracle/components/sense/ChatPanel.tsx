'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUp,
  Copy,
  Mic,
  Package,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
} from 'lucide-react';
import { COLLECTOR_ID, SCRAPE_INTERVAL_S, USER_NAME } from '@/lib/config';

interface AlertEvent {
  watch_id: string;
  product_name: string;
  value: string;
  field: string;
  operator: string;
  target: string | null;
}

interface ScarRow {
  watch_id: string | null;
  broke_at: string | null;
  healed_at: string | null;
  original_intent: string | null;
  old_selector: string | null;
  new_selector: string | null;
  confidence: number | null;
  recovery_seconds: number | null;
  description: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  kind: 'normal' | 'alert' | 'scar-log';
  text: string;
  alert?: AlertEvent;
  scars?: ScarRow[];
}

const SUGGESTIONS = [
  {
    icon: TrendingDown,
    color: '#007aff',
    title: 'Watch a price',
    sub: 'any product, any threshold',
    fill: 'Alert me when the iPhone 15 Pro drops below $950',
  },
  {
    icon: Package,
    color: '#34c759',
    title: 'Track a restock',
    sub: "get pinged the second it's back",
    fill: 'Tell me the moment AirPods Pro are back in stock',
  },
  {
    icon: Activity,
    color: '#ff9500',
    title: 'Monitor a change',
    sub: 'jobs, tickets, slots, news',
    fill: 'Watch this page and alert me when anything changes',
  },
  {
    icon: ScrollText,
    color: '#af52de',
    title: 'See the Scar Log',
    sub: 'proof it never dies',
    fill: 'Show me every time you healed yourself',
  },
];

const SPARKLE_PATH =
  'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z';

const uid = () => Math.random().toString(36).slice(2, 9);

const num = (v: string | null | undefined): number | null => {
  if (v == null) return null;
  const m = String(v).replace(/[^0-9.]/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Subscribe to alerts (SSE) — fire the tingle the instant a condition is met.
  useEffect(() => {
    const es = new EventSource('/api/watches/stream');
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as AlertEvent;
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'agent', kind: 'alert', text: '', alert: evt },
        ]);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }, []);

  async function handleSend(textOverride?: string) {
    const msg = (textOverride ?? input).trim();
    if (!msg || thinking) return;

    setMessages((prev) => [...prev, { id: uid(), role: 'user', kind: 'normal', text: msg }]);
    setInput('');
    setThinking(true);

    try {
      // Scar Log intent → render the immune-system ledger.
      if (/scar log|healed? (yourself|itself)|heal history|every time you healed/i.test(msg)) {
        const r = await fetch('/api/ledger');
        const data = await r.json();
        const scars: ScarRow[] = data.scars ?? [];
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'agent', kind: 'scar-log', text: '', scars },
        ]);
        return;
      }

      // 1. LLM intent extraction (structured JSON).
      const parsedRes = await fetch('/api/watches/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const parsed = await parsedRes.json();

      if (!parsedRes.ok || parsed.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'agent',
            kind: 'normal',
            text: 'I couldn\u2019t parse that into a watch. Try: \u201cWatch the iPhone 15 Pro and alert me when it drops below $950\u201d.',
          },
        ]);
        return;
      }

      // 2. Create the real collector-backed watch + first scrape.
      const label =
        parsed.field === 'stock'
          ? `${parsed.product_name} (${parsed.condition === 'out_of_stock' ? 'out of stock' : 'in stock'})`
          : `${parsed.product_name} under $${parsed.target_price ?? '?'}`;

      const createRes = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          url: '/api/store/html',
          intent: `Find the ${parsed.field} for the ${parsed.product_name} on this page`,
          field: parsed.field,
          operator: parsed.condition,
          target: parsed.target_price,
          query: parsed.product_name,
        }),
      });
      const created = await createRes.json();

      if (!createRes.ok || created.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'agent',
            kind: 'normal',
            text: created.error ?? 'Something went wrong creating that watch.',
          },
        ]);
        return;
      }

      const watch = created.watch;
      const collector = watch.collector_id ?? COLLECTOR_ID;
      const current = watch.last_value ?? (watch.field === 'price' ? `$${watch.target}` : '…');

      let text: string;
      if (watch.field === 'stock') {
        text = `Done \u2014 I'm watching ${watch.product_name}. It's ${current} right now. I'll ping you the moment it's back in stock. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`;
      } else {
        text = `Done \u2014 I'm watching ${watch.product_name}. It's ${current} right now. I'll ping you the moment the price drops below $${watch.target}. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`;
      }
      if (created.alerted) text += ' \uD83D\uDD14 Actually \u2014 the condition is already met.';

      setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'agent',
          kind: 'normal',
          text: 'Sorry \u2014 something went wrong reaching the backend. Is the server running?',
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function stopWatching(a: AlertEvent) {
    try {
      await fetch(`/api/watches/${a.watch_id}`, { method: 'DELETE' });
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'agent', kind: 'normal', text: `Stopped watching ${a.product_name}.` },
      ]);
    } catch {
      /* ignore */
    }
  }

  function viewProduct(a: AlertEvent) {
    window.dispatchEvent(
      new CustomEvent('sense:view-product', { detail: { product_name: a.product_name } }),
    );
  }

  function copyText(text: string, id: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      {/* ── Empty state ── */}
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#c86bff] via-[#7b61ff] to-[#0aa5ff] text-white shadow-[0_8px_24px_rgba(125,87,255,0.28)]">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
              <path d={SPARKLE_PATH} />
            </svg>
          </span>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">
            Hi {USER_NAME}! 👋
          </h1>
          <p className="mt-2 text-[15px] text-[var(--gray-1)]">What should I watch for you?</p>

          <div className="mt-8 grid w-[470px] grid-cols-2 gap-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                onClick={() => setInput(s.fill)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5 text-left transition-colors hover:bg-[var(--sidebar)]"
              >
                <s.icon size={18} style={{ color: s.color }} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                    {s.title}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--gray-1)]">{s.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Conversation state ── */
        <div className="flex-1 overflow-y-auto px-6 pt-10">
          <div className="mx-auto flex max-w-[560px] flex-col gap-4">
            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div
                    key={m.id}
                    className="ml-auto w-fit max-w-[75%] rounded-[20px] bg-[var(--ios-blue)] px-4 py-2.5 text-[15px] text-white"
                  >
                    {m.text}
                  </div>
                );
              }

              return (
                <div key={m.id} className="flex max-w-[80%] items-start gap-2.5 self-start">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#c86bff] via-[#7b61ff] to-[#0aa5ff] text-white">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
                      <path d={SPARKLE_PATH} />
                    </svg>
                  </span>

                  {/* alert variant */}
                  {m.kind === 'alert' && m.alert ? (
                    <div className="min-w-0 flex-1">
                      <div className="animate-shiver rounded-[20px] bg-[var(--bubble)] px-4 py-3 ring-2 ring-[var(--alert)]">
                        <p className="mono text-[13px] font-semibold text-[var(--alert)]">
                          {m.alert.field === 'stock' ? '\uD83D\uDD14 STOCK ALERT' : '\uD83D\uDD14 PRICE ALERT'}
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink)]">
                          {alertLine(m.alert)}
                        </p>
                        <div className="mt-2 flex items-center gap-4">
                          <button
                            onClick={() => viewProduct(m.alert!)}
                            className="text-[13px] font-medium text-[var(--store-blue)] hover:underline"
                          >
                            View Product
                          </button>
                          <button
                            onClick={() => stopWatching(m.alert!)}
                            className="text-[13px] font-medium text-[var(--gray-1)] hover:underline"
                          >
                            Stop Watching
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* normal / scar-log */
                    <div className="min-w-0 flex-1">
                      <div className="rounded-[20px] bg-[var(--bubble)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)]">
                        {m.kind === 'scar-log' ? <ScarLogTable scars={m.scars ?? []} /> : m.text}
                      </div>

                      {m.kind === 'normal' && (
                        <div className="mt-1.5 flex items-center gap-3 text-[var(--gray-2)]">
                          <button
                            onClick={() => copyText(m.text, m.id)}
                            className="flex items-center gap-1 hover:text-[var(--ink)]"
                            aria-label="Copy"
                          >
                            <Copy size={14} />
                            {copied === m.id && (
                              <span className="text-[11px] text-[var(--success)]">Copied</span>
                            )}
                          </button>
                          <button className="hover:text-[var(--ink)]" aria-label="Like">
                            <ThumbsUp size={14} />
                          </button>
                          <button className="hover:text-[var(--ink)]" aria-label="Dislike">
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {thinking && (
              <div className="flex max-w-[80%] items-start gap-2.5 self-start">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#c86bff] via-[#7b61ff] to-[#0aa5ff] text-white">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
                    <path d={SPARKLE_PATH} />
                  </svg>
                </span>
                <div className="flex items-center gap-1.5 rounded-[20px] bg-[var(--bubble)] px-4 py-3.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]" />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]"
                    style={{ animationDelay: '0.15s' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]"
                    style={{ animationDelay: '0.3s' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="shrink-0 px-6 pb-5">
        <div className="flex h-12 items-center gap-2 rounded-full bg-[var(--bubble)] pl-5 pr-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message SENSE…"
            className="flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--gray-2)]"
          />
          <Mic size={18} className="shrink-0 text-[var(--gray-1)]" />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-colors"
            style={{ background: !input.trim() || thinking ? '#c7c7cc' : 'var(--ios-blue)' }}
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

function alertLine(a: AlertEvent): string {
  if (a.field === 'stock') {
    return `${a.product_name} is ${a.value}!`;
  }
  const v = num(a.value);
  const t = num(a.target);
  if (v != null && t != null) {
    const diff = t - v;
    return diff >= 0
      ? `${a.product_name} is now ${a.value} \u2014 $${diff.toFixed(0)} under your $${t} target.`
      : `${a.product_name} is now ${a.value} \u2014 $${Math.abs(diff).toFixed(0)} over your $${t} target.`;
  }
  return `${a.product_name} is now ${a.value}.`;
}

function ScarLogTable({ scars }: { scars: ScarRow[] }) {
  if (scars.length === 0) {
    return (
      <p className="text-[14px] text-[var(--gray-1)]">
        No scars yet — nothing has broken. Break the store to see the immune system in action.
      </p>
    );
  }
  return (
    <div className="w-full">
      <p className="mono mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--gray-1)]">
        Scar Log
      </p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-[var(--gray-2)]">
            <th className="py-1.5 pr-2 font-medium">When</th>
            <th className="py-1.5 pr-2 font-medium">Event</th>
            <th className="py-1.5 pr-2 font-medium">Selector</th>
            <th className="py-1.5 font-medium">Recovery</th>
          </tr>
        </thead>
        <tbody>
          {scars.map((s, i) => (
            <tr key={i} className="border-b border-[var(--line)] align-top">
              <td className="mono whitespace-nowrap py-1.5 pr-2 text-[var(--gray-2)]">
                {fmtTime(s.broke_at)}
              </td>
              <td className="py-1.5 pr-2">{s.description ?? 'Healed'}</td>
              <td className="mono py-1.5 pr-2 text-[11px] leading-snug">
                {s.old_selector ?? '—'} → {s.new_selector ?? '—'}
              </td>
              <td className="mono py-1.5">{s.recovery_seconds ?? '—'}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
