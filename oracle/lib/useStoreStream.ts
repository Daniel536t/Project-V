'use client';

import { useEffect, useState } from 'react';

export interface StoreProduct {
  id: string;
  name: string;
  tagline: string;
  image: string;
  colors: string[];
  originalPrice: number;
  livePrice: number | null;
  inStock: boolean | null;
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
  /** "alert" (default), "watch_ready" when a pending external watch gets data. */
  kind?: string;
  /** Set on watch_ready — the collector ID that was assigned. */
  collector_id?: string | null;
}

export interface StoreState {
  products: StoreProduct[];
  template: string;
  botDetection: boolean;
  watchedProductId: string | null;
  watchStatus: string | null;
  collectorId: string | null;
  scars: number;
  latestAlert: AlertEvent | null;
}

const INITIAL: StoreState = {
  products: [],
  template: 'A',
  botDetection: false,
  watchedProductId: null,
  watchStatus: null,
  collectorId: null,
  scars: 0,
  latestAlert: null,
};

/**
 * Live store state: initial snapshot from /api/store/state, instant product
 * updates over SSE (/api/store/stream), plus a light 1s poll so watch status
 * (watching/broken/healing/healed) stays fresh on the scrape cadence. Alerts
 * arrive via /api/watches/stream and are held in `latestAlert` so the chat can
 * distribute them — ONE consumer app-wide (mounted once in StoreStreamProvider).
 */
export function useStoreStream(): StoreState {
  const [state, setState] = useState<StoreState>(INITIAL);

  useEffect(() => {
    let alive = true;
    let es: EventSource | null = null;
    let alertEs: EventSource | null = null;

    async function load() {
      try {
        const r = await fetch('/api/store/state', { cache: 'no-store' });
        const d = await r.json();
        // Merge over existing so `latestAlert` (SSE-only) is never clobbered.
        if (alive && !d.error) setState((s) => ({ ...s, ...d }));
      } catch {
        /* DB not ready — retry next tick */
      }
    }

    load();

    // Instant product/template/bot updates via SSE.
    es = new EventSource('/api/store/stream');
    es.onmessage = (e) => {
      try {
        const p = JSON.parse(e.data);
        if (!alive) return;
        setState((s) => ({
          ...s,
          template: p.template ?? s.template,
          botDetection: p.bot_detection ?? s.botDetection,
          products: s.products.map((prod) =>
            prod.id === p.id
              ? { ...prod, livePrice: Number(p.price), inStock: Boolean(p.in_stock) }
              : prod,
          ),
        }));
      } catch {
        /* ignore malformed */
      }
    };

    // Alerts (SSE) — the tingle source for the chat.
    alertEs = new EventSource('/api/watches/stream');
    alertEs.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as AlertEvent;
        if (!alive) return;
        setState((s) => ({ ...s, latestAlert: evt }));
      } catch {
        /* ignore malformed frames */
      }
    };

    // Watch status changes on the scrape cadence (cheap, keeps cards honest).
    const t = setInterval(load, 1000);

    return () => {
      alive = false;
      es?.close();
      alertEs?.close();
      clearInterval(t);
    };
  }, []);

  return state;
}
