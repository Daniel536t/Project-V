'use client';

import { useEffect, useState } from 'react';

export interface LogEntry {
  ts: number;
  level: string;
  text: string;
}

/**
 * Live collector log. The /api/logs SSE replays recent history on connect,
 * so a fresh terminal is never blank.
 */
export function useLogs(): LogEntry[] {
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

    return () => {
      alive = false;
      es.close();
    };
  }, []);

  return logs;
}
