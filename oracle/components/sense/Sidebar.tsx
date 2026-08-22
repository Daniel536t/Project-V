'use client';

import {
  MessageSquare,
  MessageSquareText,
  SquarePen,
  MoreHorizontal,
  LayoutTemplate,
  ScrollText,
  Settings,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { APP_NAME, USER_NAME, USER_PLAN } from '@/lib/config';
import { useSenseUi } from '@/lib/SenseUiContext';

const CHATS = [
  { t: 'Sony A7IV under $800',   ago: '2m ago' },
  { t: 'PS5 restock watch',      ago: '1h ago' },
  { t: 'AirPods price drop',     ago: '3h ago' },
  { t: 'MacBook Air tracking',   ago: 'Yesterday' },
  { t: 'How does healing work?', ago: '2 days ago' },
];

const TOOLS = [
  { icon: LayoutTemplate, label: 'Templates' },
  { icon: ScrollText,     label: 'Scar Log' },
  { icon: Clock,          label: 'Time Machine' },
  { icon: Settings,       label: 'Settings' },
];

export default function Sidebar() {
  const { focusInput, setScarOpen, setTimeMachineOpen } = useSenseUi();
  return (
    <aside className="w-[218px] shrink-0 bg-[var(--sense-sidebar)] border-r border-[var(--sense-line)] flex flex-col">
      {/* macOS traffic lights — exact colors and spacing */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
      </div>

      {/* App switcher row */}
      <div className="flex items-center justify-between px-4 py-2">
        <button className="flex items-center gap-1 text-[17px] font-semibold tracking-tight">
          {APP_NAME}
          <ChevronDown size={14} className="text-[var(--gray-2)] mt-0.5" />
        </button>
        <div className="flex items-center gap-3.5 text-[var(--gray-1)]">
          <SquarePen size={16} />
          <MoreHorizontal size={16} />
        </div>
      </div>

      {/* New Watch pill (mirrors "New Chat") */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={focusInput}
          className="w-full flex items-center gap-2 rounded-full bg-[var(--sense-bubble)] px-3.5 py-2 hover:bg-[var(--sense-hover)] transition-colors"
        >
          <MessageSquareText size={16} className="text-[var(--ios-blue)]" />
          <span className="text-[14px] font-medium text-[var(--ios-blue)]">New Watch</span>
          <SquarePen size={13} className="ml-auto text-[var(--gray-2)]" />
        </button>
      </div>

      {/* Chats */}
      <p className="px-4 pt-2 pb-1 text-[12px] text-[var(--gray-2)]">Chats</p>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {CHATS.map((c) => (
          <button
            key={c.t}
            className="w-full flex items-start gap-2.5 rounded-lg px-2 py-[7px] text-left hover:bg-[var(--sense-hover)] transition-colors"
          >
            <MessageSquare size={14} className="mt-[3px] shrink-0 text-[var(--gray-2)]" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-snug">{c.t}</span>
              <span className="block text-[11px] text-[var(--gray-2)]">{c.ago}</span>
            </span>
          </button>
        ))}

        {/* Tools */}
        <p className="px-2 pt-4 pb-1 text-[12px] text-[var(--gray-2)]">Tools</p>
        {TOOLS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => {
              if (label === 'Scar Log') setScarOpen(true);
              if (label === 'Time Machine') setTimeMachineOpen(true);
            }}
            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-[7px] hover:bg-[var(--sense-hover)] transition-colors"
          >
            <Icon size={15} className="text-[var(--gray-1)]" />
            <span className="text-[13px]">{label}</span>
          </button>
        ))}
      </nav>

      {/* User card — pinned bottom */}
      <div className="m-3 flex items-center gap-2.5 rounded-xl bg-[var(--sense-card)] p-2.5 border border-[var(--sense-line)]">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0aa5ff] via-[#7b61ff] to-[#c86bff] shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight truncate">{USER_NAME} Brighten</p>
          <p className="text-[11px] text-[var(--gray-2)]">{USER_PLAN}</p>
        </div>
      </div>
    </aside>
  );
}
