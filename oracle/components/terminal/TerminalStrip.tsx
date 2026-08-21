import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';

export default function TerminalStrip() {
  return (
    <div className="flex h-[215px] shrink-0 flex-col bg-[var(--term-body)] text-[#d8d8d8]">
      {/* header */}
      <div className="flex h-9 shrink-0 items-center justify-between bg-[var(--term-head)] px-4 font-sans text-[12px] text-white">
        <span className="flex items-center gap-2">
          Terminal
          <ChevronDown size={14} />
        </span>
        <span className="flex items-center gap-4 text-[var(--term-dim)]">
          <Plus size={14} />
          <MoreHorizontal size={14} />
        </span>
      </div>

      {/* body */}
      <div className="mono flex-1 overflow-hidden px-4 py-2 text-[11px] leading-[1.7]">
        <p>
          <span className="text-[var(--term-green)]">brighten@MacBook-Pro</span> ~ % npm run dev
        </p>
        <p className="text-[var(--term-dim)]">&gt; brightstore@1.0.0 dev</p>
        <p className="text-[var(--term-dim)]">&gt; next dev</p>
        <p className="text-[var(--term-dim)]">ready - started server on http://localhost:3000</p>
        <p className="text-[var(--term-dim)]">info - compiled successfully in 1.2s (123 modules)</p>
        <p className="text-[var(--term-dim)]">wait - compiling / (client and server)...</p>
        <p className="text-[var(--term-dim)]">event - compiled client and server successfully</p>
        <p>
          <span className="text-[var(--term-cyan)]">$</span> bdata scraper run c_8f2a91 --pretty
        </p>
      </div>
    </div>
  );
}
