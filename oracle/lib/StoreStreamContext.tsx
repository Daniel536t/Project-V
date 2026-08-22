'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStoreStream, type StoreState } from './useStoreStream';

const StoreStreamContext = createContext<StoreState | null>(null);

/** Hoisted store-stream provider — polls /api/store/state ONCE and shares the
 * result with Sidebar/ChatPanel/StorePanel/ProductCard via context. Zero
 * additional pollers. */
export function StoreStreamProvider({ children }: { children: ReactNode }) {
  const state = useStoreStream();
  return <StoreStreamContext.Provider value={state}>{children}</StoreStreamContext.Provider>;
}

export function useSharedStore(): StoreState {
  const ctx = useContext(StoreStreamContext);
  if (!ctx) throw new Error('useSharedStore must be used within StoreStreamProvider');
  return ctx;
}
