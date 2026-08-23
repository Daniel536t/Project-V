'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useLogs, type LogEntry } from '@/lib/useLogs';

const LEVEL_STYLE: Record<string, string> = {
  info: 'text-[var(--term-cyan)]',
  success: 'text-[var(--term-green)]',
  warn: 'text-[var(--term-amber)]',
  error: 'text-[var(--term-red)]',
  alert: 'text-[var(--alert)] font-semibold',
};

const LEVEL_ICON: Record<string, string> = {
  info: '',
  success: '✅',
  warn: '⚠️',
  error: '❌',
  alert: '🔔',
};

function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function lineText(l: LogEntry): string {
  const icon = LEVEL_ICON[l.level] ?? '';
  return `${icon}${icon ? ' ' : ''}${l.text}`;
}

export default function TerminalStrip() {
  const { logs, clear } = useLogs();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const latest = logs[logs.length - 1];

  useEffect(() => {
    if (expanded && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  // Esc closes the menu; backdrop click handled by the fixed layer below.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={`relative shrink-0 transition-[height] ${expanded ? 'h-[216px]' : 'h-8'}`}>
      <div className="flex h-8 w-full items-center gap-2 bg-[var(--term-head)] px-3 text-[12px] text-[#a3a3a8]">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2"
          aria-label={expanded ? 'Collapse terminal' : 'Expand terminal'}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="font-medium">Terminal</span>
          <ChevronDown
            size={13}
            className={`text-[var(--gray-2)] transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        </button>

        <div className="ml-auto flex items-center gap-3">
          {latest && (
            <span className={`mono max-w-[360px] truncate ${LEVEL_STYLE[latest.level] ?? ''}`}>
              {lineText(latest)}
            </span>
          )}
          <Plus size={14} className="text-[var(--gray-2)]" />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Terminal menu"
            className={`rounded p-0.5 transition-colors hover:bg-white/10 ${
              menuOpen ? 'bg-white/15' : ''
            }`}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Dropdown menu — opens upward above the header bar */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full right-2 z-50 mb-1 w-40 overflow-hidden rounded-lg border border-black/40 bg-[#1d1d21] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
              <button
                onClick={() => {
                  clear();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#d8d8d8] transition-colors hover:bg-white/10"
              >
                <Trash2 size={13} className="text-[var(--term-amber)]" />
                Clear Logs
              </button>
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div
          ref={bodyRef}
          className="mono h-[184px] overflow-y-auto bg-[var(--term-body)] px-4 py-2 text-[12px] leading-[1.75]"
        >
          <p>
            <span className="text-[var(--term-green)]">sense@sense-core</span>
            <span className="text-[var(--term-dim)]"> ~ % </span>
            <span className="text-[#e5e5ea]">
              bdata scraper run {process.env.NEXT_PUBLIC_STORE_COLLECTOR_ID} --watch --interval 30s
            </span>
          </p>
          {logs.map((l, i) => (
            <p key={i}>
              <span className="text-[var(--term-dim)]">[{fmtClock(l.ts)}]</span>{' '}
              <span className={LEVEL_STYLE[l.level] ?? ''}>{lineText(l)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
