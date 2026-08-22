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

export interface StoreState {
  products: StoreProduct[];
  template: string;
  botDetection: boolean;
  watchedProductId: string | null;
  watchStatus: string | null;
  scars: number;
}

const INITIAL: StoreState = {
  products: [],
  template: 'A',
  botDetection: false,
  watchedProductId: null,
  watchStatus: null,
  scars: 0,
};

/**
 * Live store state: initial snapshot from /api/store/state, instant product
 * updates over SSE (/api/store/stream), plus a light poll so watch status
 * (watching/broken/healing/healed) stays fresh on the scrape cadence.
 */
export function useStoreStream(): StoreState {
  const [state, setState] = useState<StoreState>(INITIAL);

  useEffect(() => {
    let alive = true;
    let es: EventSource | null = null;

    async function load() {
      try {
        const r = await fetch('/api/store/state', { cache: 'no-store' });
        const d = await r.json();
        if (alive && !d.error) setState(d);
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

    // Watch status changes on the scrape cadence (cheap, keeps cards honest).
    const t = setInterval(load, 1000);

    return () => {
      alive = false;
      es?.close();
      clearInterval(t);
    };
  }, []);

  return state;
}
