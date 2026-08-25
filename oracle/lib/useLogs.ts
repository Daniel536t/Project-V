'use client';

import { useCallback, useEffect, useState } from 'react';

export interface LogEntry {
  ts: number;
  level: string;
  text: string;
}

/**
 * Live collector log. The /api/logs SSE replays recent history on connect,
 * so a fresh terminal is never blank. `clear()` wipes the local view only —
 * the next live event appends again.
 */
export function useLogs(): { logs: LogEntry[]; clear: () => void } {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const es = new EventSource('/api/logs');

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as LogEntry;
        if (alive) setLogs((prev) => [...prev, evt].slice(-200));
      } catch {
        /* ignore malformed frames */
      }
    };

    // Server-side wipe (demo reset) — drop the local view so the terminal
    // restarts clean; the next live event appends again.
    es.addEventListener('clear', () => {
      if (alive) setLogs([]);
    });

    return () => {
      alive = false;
      es.close();
    };
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  return { logs, clear };
}
