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
}

type Listener<T> = (event: T) => void;

const logListeners = new Set<Listener<LogEvent>>();
const storeListeners = new Set<Listener<ProductState>>();
const alertListeners = new Set<Listener<AlertEvent>>();

const LOG_HISTORY: LogEvent[] = [];
const LOG_HISTORY_MAX = 300;

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
