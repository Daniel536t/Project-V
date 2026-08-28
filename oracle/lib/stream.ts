// In-memory event bus for Server-Sent Events (SSE).
// Single process (pm2) — fine for the demo. Every scrape/break/heal/alert
// and every store change flows through here so the terminal strip and the
// store panel can both subscribe over HTTP.

export type LogLevel = "info" | "success" | "warn" | "error" | "alert";

export interface LogEvent {
  ts: number;
  level: LogLevel;
  text: string;
}

export interface ProductState {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  template: string;
  bot_detection: boolean;
  stock_level: number;
}

export interface AlertEvent {
  watch_id: string;
  product_name: string;
  value: string;
  field: string;
  operator: string;
  target: string | null;
  /** Only set on spike/drop alerts — the value from the previous scrape. */
  previous?: string | null;
  /** Optional human detail (e.g. matched story title for a semantic alert). */
  detail?: string | null;
  /** Everything the scrape fetched — powers the full SENSE briefing. */
  stock?: boolean | null;
  via?: string | null;
  elapsed_s?: number | null;
  /** True when this alert fulfils the watch — it stands down after this. */
  fulfilled?: boolean;
  /** For non-alert events — "watch_ready" when a pending external watch first gets data. */
  kind?: string;
  /** For watch_ready: the collector ID that was assigned. */
  collector_id?: string | null;
}

export interface HealEvent {
  watch_id: string;
  product_name: string;
  /** "break" — the old selector stopped matching. "heal" — selector recovered. */
  stage: "break" | "heal";
  old_selector: string | null;
  new_selector: string;
  old_template: string | null;
  new_template: string;
  scar_number: number;
  /** Human label for the template ("Classic", "Modern", "Schema"). */
  template_label: string;
}

type Listener<T> = (event: T) => void;

const logListeners = new Set<Listener<LogEvent>>();
const logClearListeners = new Set<() => void>();
const storeListeners = new Set<Listener<ProductState>>();
const alertListeners = new Set<Listener<AlertEvent>>();
const healListeners = new Set<Listener<HealEvent>>();

const LOG_HISTORY: LogEvent[] = [];
const LOG_HISTORY_MAX = 300;

/**
 * Wipe the terminal history server-side and notify every connected terminal
 * (SSE) to clear its local view. Used by the demo reset so the terminal starts
 * fresh instead of replaying the previous session's logs.
 */
export function clearLogHistory(): void {
  LOG_HISTORY.length = 0;
  for (const l of Array.from(logClearListeners)) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function onLogClear(listener: () => void): () => void {
  logClearListeners.add(listener);
  return () => logClearListeners.delete(listener);
}

export function emitLog(level: LogLevel, text: string): void {
  const event: LogEvent = { ts: Date.now(), level, text };
  LOG_HISTORY.push(event);
  if (LOG_HISTORY.length > LOG_HISTORY_MAX) {
    LOG_HISTORY.splice(0, LOG_HISTORY.length - LOG_HISTORY_MAX);
  }
  for (const l of Array.from(logListeners)) {
    try {
      l(event);
    } catch {
      /* listener error must not break the pipeline */
    }
  }
}

export function logHistory(): LogEvent[] {
  return LOG_HISTORY.slice();
}

export function onLog(listener: Listener<LogEvent>): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

export function emitStore(state: ProductState): void {
  for (const l of Array.from(storeListeners)) {
    try {
      l(state);
    } catch {
      /* ignore */
    }
  }
}

export function onStore(listener: Listener<ProductState>): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

export function emitAlert(event: AlertEvent): void {
  for (const l of Array.from(alertListeners)) {
    try {
      l(event);
    } catch {
      /* ignore */
    }
  }
}

export function onAlert(listener: Listener<AlertEvent>): () => void {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
}

export function emitHeal(event: HealEvent): void {
  for (const l of Array.from(healListeners)) {
    try { l(event); } catch { /* ignore */ }
  }
}

export function onHeal(listener: Listener<HealEvent>): () => void {
  healListeners.add(listener);
  return () => healListeners.delete(listener);
}
