'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SenseUiState {
  draft: string;
  setDraft: (s: string) => void;
  scarOpen: boolean;
  setScarOpen: (b: boolean) => void;
  timeMachineOpen: boolean;
  setTimeMachineOpen: (b: boolean) => void;
  focusTick: number;
  focusInput: () => void;
  /** Incremented on demo reset — ChatPanel watches this to clear messages. */
  resetAt: number;
  triggerReset: () => void;
}

const SenseUiContext = createContext<SenseUiState | null>(null);

/** Lifted cross-panel UI state: the chat draft (prefilled by product cards),
 * the Scar Log slide-over toggle, and an input-focus signal. */
export function SenseUiProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('');
  const [scarOpen, setScarOpen] = useState(false);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [resetAt, setResetAt] = useState(0);

  const focusInput = () => setFocusTick((t) => t + 1);
  const triggerReset = () => setResetAt(Date.now());

  return (
    <SenseUiContext.Provider value={{ draft, setDraft, scarOpen, setScarOpen, timeMachineOpen, setTimeMachineOpen, focusTick, focusInput, resetAt, triggerReset }}>
      {children}
    </SenseUiContext.Provider>
  );
}

export function useSenseUi(): SenseUiState {
  const ctx = useContext(SenseUiContext);
  if (!ctx) throw new Error('useSenseUi must be used within SenseUiProvider');
  return ctx;
}
