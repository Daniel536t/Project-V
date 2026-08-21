'use client';

import { useState } from 'react';
import { APP_NAME, USER_NAME } from '@/lib/config';
import {
  Activity,
  ArrowUp,
  ArrowUpRight,
  BellRing,
  ChevronDown,
  Eye,
  HeartPulse,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';

const QUICK = [
  { title: 'Watch a product', sub: 'alert me on price drops', icon: Eye, color: '#007aff' },
  { title: 'Watch for restock', sub: 'ping me the second it is in', icon: BellRing, color: '#eab308' },
  { title: 'Check my watches', sub: 'what am I watching?', icon: Activity, color: '#16a34a' },
  { title: 'Scar Log', sub: 'every heal, scarred', icon: HeartPulse, color: '#c53df4' },
];

export default function ChatPanel() {
  const [value, setValue] = useState('');

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      {/* top bar */}
      <header className="flex h-[57px] items-center justify-between border-b border-[var(--line)] px-4">
        <div className="flex items-center gap-2 text-[17px] font-semibold text-[var(--ink)]">
          {APP_NAME}
          <ChevronDown size={16} className="text-[var(--gray-1)]" />
        </div>
        <div className="flex items-center gap-4 text-[var(--gray-1)]">
          <button aria-label="edit"><ArrowUpRight size={18} /></button>
          <button aria-label="more"><MoreHorizontal size={18} /></button>
        </div>
      </header>

      {/* conversation */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-11 pb-5 pt-[72px]">
        <span className="mb-6 grid h-16 w-16 place-items-center rounded-[15px] bg-gradient-to-br from-[#c53df4] to-[#3a8df6] text-white shadow-[0_8px_24px_rgba(125,87,255,0.28)]">
          <Sparkles size={30} strokeWidth={2.2} />
        </span>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.6px] text-[var(--ink)]">
          Hi {USER_NAME}! 👋
        </h1>
        <p className="mt-3 text-[17px] text-[var(--gray-1)]">How can I help you today?</p>

        <div className="mt-8 grid w-full max-w-[420px] grid-cols-2 gap-2.5">
          {QUICK.map((q) => (
            <button
              key={q.title}
              className="flex min-h-[60px] items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-left transition hover:border-[#d3d3d8]"
            >
              <q.icon size={19} style={{ color: q.color }} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[var(--ink)]">{q.title}</span>
                <span className="block truncate text-[11px] text-[var(--gray-2)]">{q.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* composer */}
      <div className="px-11 pb-6">
        <div className="flex min-h-[56px] items-center rounded-[18px] border border-[#dddfe3] px-4 shadow-[0_2px_7px_rgba(0,0,0,0.04)]">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Message SENSE…"
            className="flex-1 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--gray-2)]"
          />
          <button
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ios-blue)] text-white"
            aria-label="Send"
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
