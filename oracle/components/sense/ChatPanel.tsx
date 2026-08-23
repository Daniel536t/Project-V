'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useSharedStore } from '@/lib/StoreStreamContext';
import { useSenseUi } from '@/lib/SenseUiContext';
import { featuredById, suggestedWatchTarget } from '@/lib/store-shared';
import type { AlertEvent } from '@/lib/useStoreStream';

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

/** Shape of POST /api/watches responses. */
interface CreatedWatch {
  error?: string;
  alerted?: boolean;
  watch?: {
    collector_id?: string | null;
    last_value?: string | null;
    field?: string;
    target?: string | null;
    product_name?: string;
  } | null;
}

/** Shape of GET/POST /api/watches/parse-intent responses. */
interface ParsedIntent {
  kind: 'store' | 'live';
  product_name?: string;
  target_price?: number | null;
  condition?: string;
  field?: string;
  name?: string;
  topic?: string;
  rank?: number;
  url?: string;
  error?: string;
}

const iphone = featuredById('iphone-17-pro')!;
const airpods = featuredById('airpods-pro-2')!;

const SUGGESTIONS = [
  {
    icon: TrendingDown,
    color: '#007aff',
    title: 'Watch a price',
    sub: 'any product, any threshold',
    fill: `Alert me when the ${iphone.name} drops below $${suggestedWatchTarget(iphone.price)}`,
  },
  {
    icon: Package,
    color: '#34c759',
    title: 'Track a restock',
    sub: "get pinged the second it's back",
    fill: `Tell me the moment ${airpods.name} are back in stock`,
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

interface JsonResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

/** fetch + JSON parse that throws { status } on non-JSON/non-OK responses. */
async function fetchJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    /* non-JSON body (e.g. Next.js 404 HTML) */
  }
  if (!res.ok && !data) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return { ok: res.ok, status: res.status, data };
}

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

function statusChip(status: string | null, collectorId: string | null, scars: number) {
  switch (status) {
    case 'broken':
      return { dot: 'var(--danger)', label: '● Broken', cls: 'text-[var(--danger)]' };
    case 'healing':
      return { dot: 'var(--amber)', label: '● Healing…', cls: 'animate-pulse text-[var(--amber)]' };
    case 'healed':
      return {
        dot: 'var(--success)',
        label: `● Healed · Scar #${scars}`,
        cls: 'text-[var(--success)]',
      };
    case 'alerted':
      return { dot: 'var(--alert)', label: '● Alert sent', cls: 'text-[var(--alert)]' };
    case 'checking':
      return { dot: 'var(--gray-2)', label: '● Checking', cls: 'text-[var(--gray-1)]' };
    default:
      return {
        dot: 'var(--success)',
        label: `● Watching · ${collectorId ?? COLLECTOR_ID}`,
        cls: 'text-[var(--gray-1)]',
      };
  }
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { latestAlert, watchStatus, collectorId, scars } = useSharedStore();
  const { draft, setDraft, focusTick, focusInput, resetAt } = useSenseUi();

  // Focus the composer when the sidebar "New Watch" or a product card asks.
  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus();
  }, [focusTick]);

  // Ping sound on new agent messages — subtle, like a text notification.
  const msgLenRef = useRef(0);
  useEffect(() => {
    const newMsgs = messages.slice(msgLenRef.current);
    msgLenRef.current = messages.length;
    const hasAgent = newMsgs.some((m) => m.role === 'agent');
    if (!hasAgent) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      // Two-note chime: C5 → E5, quick, quiet, warm
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523, now);        // C5
      osc.frequency.setValueAtTime(659, now + 0.08);  // E5
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.15);
      gain.gain.linearRampToValueAtTime(0, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      /* AudioContext may fail without user gesture — fine, silent fallback */
    }
  }, [messages]);

  // Clear chat when demo is reset (the Reset Demo State button in the admin popup).
  useEffect(() => {
    if (resetAt > 0) setMessages([]);
  }, [resetAt]);

  // Alerts arrive via the shared stream — push the tingle message when a new
  // one lands (deduped by watch+value so a re-render never double-fires).
  // Also fetch the companion voice judgment.
  const lastAlertKey = useRef<string | null>(null);
  useEffect(() => {
    if (!latestAlert) return;
    const key = `${latestAlert.watch_id}:${latestAlert.value}:${latestAlert.field}`;
    if (lastAlertKey.current === key) return;
    lastAlertKey.current = key;
    const alert = latestAlert;
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'agent', kind: 'alert', text: '', alert },
    ]);
    // Fetch companion voice asynchronously — render it when it arrives.
    fetch('/api/alerts/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: alert.product_name,
        value: alert.value,
        operator: alert.operator,
        target: alert.target,
        previous: alert.previous,
        field: alert.field,
      }),
    }).then(r => r.json()).then(d => {
      if (d.voice) {
        setMessages((prev) =>
          prev.map((m) =>
            m.alert && m.alert.watch_id === alert.watch_id && !m.text
              ? { ...m, text: d.voice }
              : m
          )
        );
      }
    }).catch(() => {});
  }, [latestAlert]);

  async function handleSend() {
    const msg = draft.trim();
    if (!msg || thinking) return;

    setMessages((prev) => [...prev, { id: uid(), role: 'user', kind: 'normal', text: msg }]);
    setDraft('');
    setThinking(true);

    try {
      // Scar Log intent → render the immune-system ledger.
      if (/scar log|healed? (yourself|itself)|heal history|every time you healed/i.test(msg)) {
        const r = await fetch('/api/heal-ledger');
        const data = await r.json();
        const scars: ScarRow[] = data.scars ?? [];
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'agent', kind: 'scar-log', text: '', scars },
        ]);
        return;
      }

      // 1. LLM intent extraction (structured JSON).
      const parsedRes = await fetchJson<ParsedIntent>('/api/watches/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const parsed = parsedRes.data;

      if (!parsedRes.ok || !parsed || parsed.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'agent',
            kind: 'normal',
            text: 'I couldn\u2019t parse that into a watch. Try: \u201cWatch the iPhone 17 Pro and alert me when it drops below $949\u201d.',
          },
        ]);
        return;
      }

      // LIVE semantic watch ("watch HN and alert me when an AI-agents story hits the top 5")
      if (parsed.kind === 'live') {
        const createRes = await fetchJson<CreatedWatch>('/api/watches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: `${parsed.name} — ${parsed.topic} in top ${parsed.rank}`,
            url: parsed.url,
            intent: `Extract the top stories from the front page (title, url, points, comments) and find stories about ${parsed.topic}`,
            field: 'rank',
            operator: '<=',
            target: String(parsed.rank),
            query: parsed.topic,
            source: 'live',
          }),
        });
        const created = createRes.data;
        if (!createRes.ok || !created || created.error) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'agent',
              kind: 'normal',
              text: created?.error ?? 'Something went wrong creating that watch.',
            },
          ]);
          return;
        }
        const liveWatch = created.watch;
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'agent',
            kind: 'normal',
            text: `Done — I'm watching ${parsed.name}. I'll ping you the moment a ${parsed.topic} story breaks into the top ${parsed.rank}. Collector ${liveWatch?.collector_id ?? COLLECTOR_ID} · checking every few minutes.`,
          },
        ]);
        return;
      }

      // 2. Create the real collector-backed watch + first scrape.
      const label =
        parsed.field === 'stock'
          ? `${parsed.product_name} (${parsed.condition === 'out_of_stock' ? 'out of stock' : 'in stock'})`
          : `${parsed.product_name} under $${parsed.target_price ?? '?'}`;

      const createRes = await fetchJson<CreatedWatch>('/api/watches', {
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
      const created = createRes.data;

      if (!createRes.ok || !created || created.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'agent',
            kind: 'normal',
            text: created?.error ?? 'Something went wrong creating that watch.',
          },
        ]);
        return;
      }

      const watch = created.watch;
      const collector = watch?.collector_id ?? COLLECTOR_ID;
      const current = watch?.last_value ?? (watch?.field === 'price' ? `$${watch.target}` : '…');

      let text: string;
      if (watch?.field === 'stock') {
        text = `Done \u2014 I'm watching ${watch?.product_name}. It's ${current} right now. I'll ping you the moment it's back in stock. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`;
      } else {
        text = `Done \u2014 I'm watching ${watch?.product_name}. It's ${current} right now. I'll ping you the moment the price drops below $${watch?.target}. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`;
      }
      if (created.alerted) {
        const already = watch?.field === 'stock' ? "it's already in stock" : "it's already below your target";
        text += ` Heads up \u2014 ${already}, so I won't fire an alert for it now. If the condition clears and comes back, I'll ping you then.`;
      }

      setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text }]);
    } catch (e) {
      const status =
        typeof e === 'object' && e !== null && 'status' in e
          ? Number((e as { status: number }).status)
          : null;
      let text: string;
      if (status === 404) {
        // The Vercel deployment is the store-only mirror (Bright Data's
        // scrape target). The SENSE runtime — scheduler, CLI, SSE — lives on
        // the pm2 instance at claude-coder.duckdns.org.
        text =
          'This deployment is the store mirror \u2014 the SENSE backend isn\u2019t here. Open the full app at claude-coder.duckdns.org.';
      } else if (status != null) {
        text = `The backend returned ${status}. The scheduler is running on the instance \u2014 try again in a few seconds.`;
      } else {
        text =
          'Sorry \u2014 something went wrong reaching the backend. The SENSE server runs on the instance at claude-coder.duckdns.org \u2014 if that page loads, try again.';
      }
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'agent', kind: 'normal', text },
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
  const chip = watchStatus
    ? statusChip(watchStatus, collectorId, scars)
    : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--sense-bg)]">
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

          <div className="mt-8 grid w-full max-w-[470px] grid-cols-2 gap-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                onClick={() => {
                  setDraft(s.fill);
                  focusInput();
                }}
                className="flex items-center gap-3 rounded-2xl border border-[var(--sense-line)] bg-[var(--sense-card)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--sense-hover)] sense-card-depth"
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
                      <div className="animate-shiver rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3 ring-2 ring-[var(--alert)]">
                        <p className="mono text-[13px] font-semibold text-[var(--alert)]">
                          {m.alert.field === 'stock' ? '\uD83D\uDD14 STOCK ALERT' : m.alert.field === 'rank' ? '\uD83D\uDD14 SENSE ALERT' : m.alert.field === 'stock' ? '\uD83D\uDD14 STOCK ALERT' : m.alert.operator === 'spike' ? '\u26A0\uFE0F SPIKE ALERT' : m.alert.operator === 'drop' ? '\uD83D\uDCC9 DROP ALERT' : '\uD83D\uDD14 PRICE ALERT'}
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink)]">
                          {alertLine(m.alert)}
                        </p>
                        {/* Companion voice — fetched async, appears when ready */}
                        {m.text && (
                          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--gray-1)] italic">
                            {m.text}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
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
                        {/* Action chips — redirect attention to different products/strategies */}
                        {m.alert.field === 'price' && (() => {
                          const t = num(m.alert.target);
                          const raiseTarget = t != null ? t + 150 : null;
                          const other = airpods;
                          return (
                            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--sense-line)] pt-2.5">
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch(`/api/watches/${m.alert!.watch_id}`, { method: 'DELETE' });
                                  } catch {}
                                  setDraft(`Keep watching ${m.alert!.product_name}`);
                                  focusInput();
                                }}
                                className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors"
                              >
                                Keep watching
                              </button>
                              {raiseTarget != null && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch(`/api/watches/${m.alert!.watch_id}`, { method: 'DELETE' });
                                    } catch {}
                                    setDraft(`Alert me when the ${m.alert!.product_name} drops below $${raiseTarget}`);
                                    focusInput();
                                  }}
                                  className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors"
                                >
                                  Raise target to ${raiseTarget}
                                </button>
                              )}
                              {other && (
                                <button
                                  onClick={() => {
                                    setDraft(`Alert me when the ${other.name} drops below $${suggestedWatchTarget(other.price)}`);
                                    focusInput();
                                  }}
                                  className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors"
                                >
                                  Watch {other.name} instead — {other.priceLabel}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* normal / scar-log */
                    <div className="min-w-0 flex-1">
                      <div className="rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)]">
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
                <div className="flex items-center gap-1.5 rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3.5">
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
        {chip && (
          <div className="mb-2 flex h-6 w-fit items-center gap-1.5 rounded-full bg-[var(--sense-bubble)] px-3 text-[11.5px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.dot }} />
            <span className={chip.cls}>{chip.label}</span>
          </div>
        )}
        <div className="flex h-12 items-center gap-2 rounded-full bg-[var(--sense-bubble)] pl-5 pr-2 border border-[var(--sense-line)]">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message SENSE…"
            className="flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--gray-2)]"
          />
          <Mic size={18} className="shrink-0 text-[var(--gray-1)]" />
          <button
            onClick={() => handleSend()}
            disabled={!draft.trim() || thinking}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-colors"
            style={{ background: !draft.trim() || thinking ? '#c7c7cc' : 'var(--ios-blue)' }}
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
  if (a.field === 'rank') {
    return a.detail
      ? `A story just hit #${a.value} on ${a.product_name}: "${a.detail}"`
      : `A story just hit the top ${a.target} on ${a.product_name} (rank #${a.value}).`;
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
          <tr className="border-b border-[var(--sense-line)] text-left text-[var(--gray-2)]">
            <th className="py-1.5 pr-2 font-medium">When</th>
            <th className="py-1.5 pr-2 font-medium">Event</th>
            <th className="py-1.5 pr-2 font-medium">Selector</th>
            <th className="py-1.5 font-medium">Recovery</th>
          </tr>
        </thead>
        <tbody>
          {scars.map((s, i) => (
            <tr key={i} className="border-b border-[var(--sense-line)] align-top">
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
