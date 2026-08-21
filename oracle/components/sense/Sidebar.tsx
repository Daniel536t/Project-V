import { APP_NAME, USER_NAME, USER_PLAN } from '@/lib/config';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Layers,
  MessageSquare,
  Pencil,
  Settings,
  Sparkles,
} from 'lucide-react';

const CHATS = [
  { title: 'Watch iPhone 15 Pro', time: '2m ago' },
  { title: 'AirPods restock', time: '1h ago' },
  { title: 'MacBook price drop', time: '3h ago' },
];

const TOOLS = [
  { label: 'Templates', icon: Layers },
  { label: 'Scar Log', icon: BookOpen },
  { label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="flex w-[232px] shrink-0 select-none flex-col border-r border-[var(--line)] bg-[var(--sidebar)] px-3 pb-3 pt-3">
      {/* macOS traffic lights */}
      <div className="mb-6 flex items-center gap-2 pl-2 pt-1">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      {/* brand */}
      <div className="mb-6 flex items-center gap-2 pl-2">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-[#c53df4] to-[#3a8df6] text-white">
          <Sparkles size={13} strokeWidth={2.4} />
        </span>
        <span className="text-[16px] font-semibold text-[var(--ink)]">{APP_NAME}</span>
        <ChevronDown size={15} className="text-[var(--gray-1)]" />
      </div>

      {/* New Chat */}
      <button className="mb-6 flex h-11 items-center justify-between rounded-[10px] bg-[#eef1f5] px-3 text-[var(--ios-blue)] transition hover:bg-[#e4e8ee]">
        <span className="flex items-center gap-2.5 text-[14px]">
          <Pencil size={16} />
          New Chat
        </span>
        <ArrowUpRight size={16} />
      </button>

      {/* Chats */}
      <p className="mb-2 px-2 text-[13px] text-[var(--gray-1)]">Chats</p>
      <div className="flex flex-col gap-0.5">
        {CHATS.map((c) => (
          <button
            key={c.title}
            className="rounded-lg px-2 py-2 text-left transition hover:bg-[#efeff1]"
          >
            <span className="flex items-center gap-2 truncate text-[12.5px] text-[var(--ink)]">
              <MessageSquare size={14} className="shrink-0 text-[var(--gray-1)]" />
              {c.title}
            </span>
            <span className="mt-1 block pl-6 text-[11px] text-[var(--gray-2)]">{c.time}</span>
          </button>
        ))}
      </div>

      {/* divider */}
      <div className="mx-2 my-4 h-px bg-[var(--line)]" />

      {/* Tools */}
      <p className="mb-2 px-2 text-[13px] text-[var(--gray-1)]">Tools</p>
      {TOOLS.map((t) => (
        <button
          key={t.label}
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[13px] text-[var(--ink)] transition hover:bg-[#efeff1]"
        >
          <t.icon size={16} className="text-[#555]" />
          {t.label}
        </button>
      ))}

      {/* profile */}
      <div className="mt-auto flex items-center gap-2.5 rounded-[10px] border border-[#e2e2e5] bg-white p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#eee] to-[#c9c9c9] text-[14px] font-semibold text-[var(--gray-1)]">
          {USER_NAME.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{USER_NAME}</span>
          <span className="block text-[10px] text-[var(--gray-1)]">{USER_PLAN}</span>
        </span>
      </div>
    </aside>
  );
}
