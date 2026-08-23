'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  ts: number;
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
  kind: 'store' | 'live' | 'external';
  product_name?: string;
  target_price?: number | null;
  condition?: string;
  field?: string;
  name?: string;
  topic?: string;
  rank?: number;
  url?: string;
  label?: string;
  operator?: string;
  target?: string | null;
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

// ── Helpers ──

const fmtAgo = (ts: number): string => {
  const diff = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface JsonResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

async function fetchJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {}
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
      return { dot: 'var(--success)', label: `● Healed · Scar #${scars}`, cls: 'text-[var(--success)]' };
    case 'alerted':
      return { dot: 'var(--alert)', label: '● Alert sent', cls: 'text-[var(--alert)]' };
    case 'checking':
      return { dot: 'var(--gray-2)', label: '● Checking', cls: 'text-[var(--gray-1)]' };
    case 'pending':
      return { dot: 'var(--amber)', label: '● Creating collector…', cls: 'animate-pulse text-[var(--amber)]' };
    default:
      return { dot: 'var(--success)', label: `● Watching · ${collectorId ?? COLLECTOR_ID}`, cls: 'text-[var(--gray-1)]' };
  }
}

// ── Shared mini avatar ──

function AgentAvatar({ size = 24 }: { size?: number }) {
  const s = size;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md text-white"
      style={{
        width: s,
        height: s,
        background: 'linear-gradient(135deg, #c8a96e 0%, #b8944f 50%, #8b6914 100%)',
        boxShadow: `0 2px 8px rgba(184, 148, 79, 0.25)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={Math.round(s * 0.5)} height={Math.round(s * 0.5)} fill="currentColor" aria-hidden>
        <path d={SPARKLE_PATH} />
      </svg>
    </span>
  );
}

// ══════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { latestAlert, watchStatus, collectorId, scars } = useSharedStore();
  const { draft, setDraft, focusTick, focusInput, resetAt } = useSenseUi();

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // Focus
  useEffect(() => { if (focusTick > 0) inputRef.current?.focus(); }, [focusTick]);

  // Ping sound
  const msgLenRef = useRef(0);
  useEffect(() => {
    const newMsgs = messages.slice(msgLenRef.current);
    msgLenRef.current = messages.length;
    if (!newMsgs.some((m) => m.role === 'agent')) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.08);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.15);
      gain.gain.linearRampToValueAtTime(0, now + 0.28);
      osc.start(now); osc.stop(now + 0.3);
    } catch {}
  }, [messages]);

  // Reset
  useEffect(() => { if (resetAt > 0) setMessages([]); }, [resetAt]);

  // Alerts
  const lastAlertKey = useRef<string | null>(null);
  useEffect(() => {
    if (!latestAlert) return;
    const key = `${latestAlert.watch_id}:${latestAlert.value}:${latestAlert.field}`;
    if (lastAlertKey.current === key) return;
    lastAlertKey.current = key;
    const alert = latestAlert;
    setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'alert', text: '', alert, ts: Date.now() }]);
    fetch('/api/alerts/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: alert.product_name, value: alert.value, operator: alert.operator, target: alert.target, previous: alert.previous, field: alert.field }),
    }).then(r => r.json()).then(d => {
      if (d.voice) setMessages((prev) => prev.map((m) => m.alert && m.alert.watch_id === alert.watch_id && !m.text ? { ...m, text: d.voice } : m));
    }).catch(() => {});
  }, [latestAlert]);

  async function handleSend() {
    const msg = draft.trim();
    if (!msg || thinking) return;
    const now = Date.now();
    setMessages((prev) => [...prev, { id: uid(), role: 'user', kind: 'normal', text: msg, ts: now }]);
    setDraft('');
    setThinking(true);

    try {
      if (/scar log|healed? (yourself|itself)|heal history|every time you healed/i.test(msg)) {
        const r = await fetch('/api/heal-ledger');
        const data = await r.json();
        setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'scar-log', text: '', scars: data.scars ?? [], ts: Date.now() }]);
        return;
      }

      const parsedRes = await fetchJson<ParsedIntent>('/api/watches/parse-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      const parsed = parsedRes.data;

      if (!parsedRes.ok || !parsed || parsed.error) {
        setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: 'I couldn\u2019t parse that into a watch. Try: \u201cWatch the iPhone 17 Pro and alert me when it drops below $949\u201d.', ts: Date.now() }]);
        return;
      }

      if (parsed.kind === 'external') {
        const createRes = await fetchJson<CreatedWatch>('/api/watches', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: parsed.label ?? 'external watch',
            url: parsed.url,
            intent: `Extract: product name, ${parsed.field === 'stock' ? 'stock status' : 'price as a number'}`,
            field: parsed.field ?? 'price',
            operator: parsed.operator ?? 'changed',
            target: parsed.target ?? null,
            query: parsed.label,
            source: 'external',
          }),
        });
        const created = createRes.data;
        if (!createRes.ok || !created || created.error) {
          setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: created?.error ?? 'Something went wrong creating that watch.', ts: Date.now() }]);
          return;
        }
        const w = created.watch;
        const domain = (() => { try { return new URL(parsed.url!).hostname.replace(/^www\./, ''); } catch { return parsed.url!; } })();
        setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: `Done — I created a fresh collector (${w?.collector_id ?? '?'}) for ${domain} and I'm scraping it now. I'll ping you ${parsed.field === 'stock' ? 'when stock changes' : parsed.target ? `when the price ${parsed.operator === '<' ? 'drops below' : parsed.operator === '>' ? 'rises above' : 'changes from'} $${parsed.target}` : 'when the price changes'}.`, ts: Date.now() }]);
        return;
      }

      if (parsed.kind === 'live') {
        const createRes = await fetchJson<CreatedWatch>('/api/watches', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: `${parsed.name} \u2014 ${parsed.topic} in top ${parsed.rank}`, url: parsed.url, intent: `Extract the top stories from the front page (title, url, points, comments) and find stories about ${parsed.topic}`, field: 'rank', operator: '<=', target: String(parsed.rank), query: parsed.topic, source: 'live' }),
        });
        const created = createRes.data;
        if (!createRes.ok || !created || created.error) {
          setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: created?.error ?? 'Something went wrong creating that watch.', ts: Date.now() }]);
          return;
        }
        const w = created.watch;
        setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: `Done \u2014 I'm watching ${parsed.name}. I'll ping you the moment a ${parsed.topic} story breaks into the top ${parsed.rank}. Collector ${w?.collector_id ?? COLLECTOR_ID} \u00b7 checking every few minutes.`, ts: Date.now() }]);
        return;
      }

      const createRes = await fetchJson<CreatedWatch>('/api/watches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: parsed.field === 'stock' ? `${parsed.product_name} (${parsed.condition === 'out_of_stock' ? 'out of stock' : 'in stock'})` : `${parsed.product_name} under $${parsed.target_price ?? '?'}`, url: '/api/store/html', intent: `Find the ${parsed.field} for the ${parsed.product_name} on this page`, field: parsed.field, operator: parsed.condition, target: parsed.target_price, query: parsed.product_name }),
      });
      const created = createRes.data;
      if (!createRes.ok || !created || created.error) {
        setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: created?.error ?? 'Something went wrong creating that watch.', ts: Date.now() }]);
        return;
      }

      const w = created.watch;
      const collector = w?.collector_id ?? COLLECTOR_ID;
      const current = w?.last_value ?? (w?.field === 'price' ? `$${w.target}` : '\u2026');
      let text = w?.field === 'stock'
        ? `Done \u2014 I'm watching ${w?.product_name}. It's ${current} right now. I'll ping you the moment it's back in stock. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`
        : `Done \u2014 I'm watching ${w?.product_name}. It's ${current} right now. I'll ping you the moment the price drops below $${w?.target}. Collector ${collector} \u00b7 checking every ${SCRAPE_INTERVAL_S}s.`;
      if (created.alerted) {
        const already = w?.field === 'stock' ? "it's already in stock" : "it's already below your target";
        text += ` Heads up \u2014 ${already}, so I won't fire an alert for it now. If the condition clears and comes back, I'll ping you then.`;
      }
      setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text, ts: Date.now() }]);
    } catch (e) {
      const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: number }).status) : null;
      const text = status === 404 ? 'This deployment is the store mirror \u2014 the SENSE backend isn\u2019t here. Open the full app at claude-coder.duckdns.org.' : status != null ? `The backend returned ${status}. Try again in a few seconds.` : 'Sorry \u2014 something went wrong reaching the backend. Is the server running?';
      setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text, ts: Date.now() }]);
    } finally { setThinking(false); }
  }

  function stopWatching(a: AlertEvent) {
    fetch(`/api/watches/${a.watch_id}`, { method: 'DELETE' }).catch(() => {});
    setMessages((prev) => [...prev, { id: uid(), role: 'agent', kind: 'normal', text: `Stopped watching ${a.product_name}.`, ts: Date.now() }]);
  }

  function copyText(text: string, id: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }

  const empty = messages.length === 0;
  const chip = watchStatus ? statusChip(watchStatus, collectorId, scars) : null;

  // Group consecutive same-role messages
  const grouped: { items: Message[]; firstIdx: number }[] = [];
  let run: Message[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (run.length === 0 || messages[i].role === run[0].role) {
      run.push(messages[i]);
    } else {
      grouped.push({ items: run, firstIdx: i - run.length });
      run = [messages[i]];
    }
  }
  if (run.length) grouped.push({ items: run, firstIdx: messages.length - run.length });

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--sense-bg)]">
      {/* ── Empty state ── */}
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #c8a96e 0%, #b8944f 50%, #8b6914 100%)', boxShadow: '0 8px 28px rgba(184,148,79,0.32)' }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
              <path d={SPARKLE_PATH} />
            </svg>
          </span>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">
            Hi {USER_NAME}! <span className="inline-block animate-[wave_2s_ease-in-out_infinite]" style={{ transformOrigin: '70% 70%' }}>👋</span>
          </h1>
          <p className="mt-2 text-[15px] text-[var(--gray-1)]">What should I watch for you?</p>
          {/* Online indicator */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
            <span className="text-[11.5px] text-[var(--gray-2)]">Online now</span>
          </div>

          <div className="mt-8 grid w-full max-w-[470px] grid-cols-2 gap-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                onClick={() => { setDraft(s.fill); focusInput(); }}
                className="flex items-center gap-3 rounded-2xl border border-[var(--sense-line)] bg-[var(--sense-card)] px-4 py-3.5 text-left transition-all hover:bg-[var(--sense-hover)] hover:shadow-sm sense-card-depth"
              >
                <s.icon size={18} style={{ color: s.color }} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">{s.title}</span>
                  <span className="block truncate text-[12px] text-[var(--gray-1)]">{s.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Conversation ── */
        <div className="flex-1 overflow-y-auto px-6 pt-10">
          <div className="mx-auto flex max-w-[560px] flex-col gap-1">
            <AnimatePresence initial={false}>
              {grouped.map((g) => {
                const first = g.items[0];
                const isUser = first.role === 'user';

                if (isUser) {
                  return (
                    <div key={first.id} className="flex flex-col items-end gap-0.5 pt-3">
                      {g.items.map((m) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 12, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="w-fit max-w-[75%] rounded-[20px] bg-[var(--ios-blue)] px-4 py-2.5 text-[15px] leading-relaxed text-white"
                        >
                          {m.text}
                        </motion.div>
                      ))}
                      <span className="pr-1 text-[10.5px] text-[var(--gray-2)]">{fmtAgo(first.ts)}</span>
                    </div>
                  );
                }

                // Agent group
                return (
                  <div key={first.id} className="flex max-w-[80%] items-start gap-2.5 self-start pt-3">
                    <AgentAvatar size={24} />
                    <div className="min-w-0 flex-1">
                      {g.items.map((m) => {
                        if (m.kind === 'alert' && m.alert) {
                          return (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className="animate-shiver rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3 ring-2 ring-[var(--alert)] animate-[alert-pulse_3s_ease-in-out_infinite]"
                            >
                              <p className="mono text-[13px] font-semibold text-[var(--alert)]">
                                {m.alert.field === 'rank' ? '\uD83D\uDD14 SENSE ALERT' : m.alert.operator === 'spike' ? '\u26A0\uFE0F SPIKE ALERT' : m.alert.operator === 'drop' ? '\uD83D\uDCC9 DROP ALERT' : '\uD83D\uDD14 PRICE ALERT'}
                              </p>
                              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink)]">{alertLine(m.alert)}</p>
                              {m.text && <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--gray-1)] italic">{m.text}</p>}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button onClick={() => window.dispatchEvent(new CustomEvent('sense:view-product', { detail: { product_name: m.alert!.product_name } }))} className="text-[13px] font-medium text-[var(--store-blue)] hover:underline">View Product</button>
                                <button onClick={() => stopWatching(m.alert!)} className="text-[13px] font-medium text-[var(--gray-1)] hover:underline">Stop Watching</button>
                              </div>
                              {/* Action chips */}
                              {m.alert.field === 'price' && (() => {
                                const t = num(m.alert.target);
                                const raiseTarget = t != null ? t + 150 : null;
                                return (
                                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--sense-line)] pt-2.5">
                                    <button onClick={async () => { await fetch(`/api/watches/${m.alert!.watch_id}`, { method: 'DELETE' }).catch(() => {}); setDraft(`Keep watching ${m.alert!.product_name}`); focusInput(); }} className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors">Keep watching</button>
                                    {raiseTarget != null && <button onClick={async () => { await fetch(`/api/watches/${m.alert!.watch_id}`, { method: 'DELETE' }).catch(() => {}); setDraft(`Alert me when the ${m.alert!.product_name} drops below $${raiseTarget}`); focusInput(); }} className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors">Raise target to ${raiseTarget}</button>}
                                    <button onClick={() => { setDraft(`Alert me when the ${airpods.name} drops below $${suggestedWatchTarget(airpods.price)}`); focusInput(); }} className="rounded-full bg-[var(--sense-card)] px-3 py-1 text-[11.5px] font-medium border border-[var(--sense-line)] hover:bg-[var(--sense-hover)] transition-colors">Watch {airpods.name} instead — {airpods.priceLabel}</button>
                                  </div>
                                );
                              })()}
                            </motion.div>
                          );
                        }

                        return (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <div className="rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)]">
                              {m.kind === 'scar-log' ? <ScarLogTable scars={m.scars ?? []} /> : m.text}
                            </div>
                            {m.kind === 'normal' && (
                              <div className="mt-1.5 flex items-center gap-3 text-[var(--gray-2)]">
                                <button onClick={() => copyText(m.text, m.id)} className="flex items-center gap-1 hover:text-[var(--ink)]" aria-label="Copy"><Copy size={14} />{copied === m.id && <span className="text-[11px] text-[var(--success)]">Copied</span>}</button>
                                <button className="hover:text-[var(--ink)]" aria-label="Like"><ThumbsUp size={14} /></button>
                                <button className="hover:text-[var(--ink)]" aria-label="Dislike"><ThumbsDown size={14} /></button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                      <span className="pl-1 text-[10.5px] text-[var(--gray-2)]">{fmtAgo(first.ts)}</span>
                    </div>
                  </div>
                );
              })}
            </AnimatePresence>

            {thinking && (
              <div className="flex max-w-[80%] items-start gap-2.5 self-start pt-3">
                <AgentAvatar size={24} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 rounded-[20px] bg-[var(--sense-bubble)] px-4 py-3.5"
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]" style={{ animationDelay: '0.15s' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-2)]" style={{ animationDelay: '0.3s' }} />
                </motion.div>
              </div>
            )}
            <div ref={bottomRef} />
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
        <div className={`flex h-12 items-center gap-2 rounded-full bg-[var(--sense-bubble)] pl-5 pr-2 border transition-shadow duration-300 ${inputFocused ? 'border-[var(--sense-hover)] shadow-[0_0_0_3px_rgba(200,169,110,0.15)]' : 'border-[var(--sense-line)]'}`}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Message SENSE…"
            className="flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--gray-2)]"
          />
          <Mic size={18} className="shrink-0 text-[var(--gray-1)]" />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSend()}
            disabled={!draft.trim() || thinking}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
            style={{ background: !draft.trim() || thinking ? '#c7c7cc' : 'var(--ios-blue)' }}
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Alert line ──
function alertLine(a: AlertEvent): string {
  if (a.field === 'stock') return `${a.product_name} is ${a.value}!`;
  if (a.field === 'rank') return a.detail ? `A story just hit #${a.value} on ${a.product_name}: "${a.detail}"` : `A story just hit the top ${a.target} on ${a.product_name} (rank #${a.value}).`;
  const v = num(a.value);
  const t = num(a.target);
  if (v != null && t != null) {
    const diff = t - v;
    return diff >= 0 ? `${a.product_name} is now ${a.value} \u2014 $${diff.toFixed(0)} under your $${t} target.` : `${a.product_name} is now ${a.value} \u2014 $${Math.abs(diff).toFixed(0)} over your $${t} target.`;
  }
  return `${a.product_name} is now ${a.value}.`;
}

// ── Scar log table ──
function ScarLogTable({ scars }: { scars: ScarRow[] }) {
  if (scars.length === 0) return <p className="text-[14px] text-[var(--gray-1)]">No scars yet — nothing has broken. Break the store to see the immune system in action.</p>;
  return (
    <div className="w-full">
      <p className="mono mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--gray-1)]">Scar Log</p>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="border-b border-[var(--sense-line)] text-left text-[var(--gray-2)]"><th className="py-1.5 pr-2 font-medium">When</th><th className="py-1.5 pr-2 font-medium">Event</th><th className="py-1.5 pr-2 font-medium">Selector</th><th className="py-1.5 font-medium">Recovery</th></tr></thead>
        <tbody>{scars.map((s, i) => (<tr key={i} className="border-b border-[var(--sense-line)] align-top"><td className="mono whitespace-nowrap py-1.5 pr-2 text-[var(--gray-2)]">{fmtTime(s.broke_at)}</td><td className="py-1.5 pr-2">{s.description ?? 'Healed'}</td><td className="mono py-1.5 pr-2 text-[11px] leading-snug">{s.old_selector ?? '\u2014'} \u2192 {s.new_selector ?? '\u2014'}</td><td className="mono py-1.5">{s.recovery_seconds ?? '\u2014'}s</td></tr>))}</tbody>
      </table>
    </div>
  );
}