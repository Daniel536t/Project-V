'use client';

import { StoreStreamProvider } from '@/lib/StoreStreamContext';
import { SenseUiProvider } from '@/lib/SenseUiContext';
import Sidebar from '@/components/sense/Sidebar';
import ChatPanel from '@/components/sense/ChatPanel';
import StorePanel from '@/components/store/StorePanel';
import TerminalStrip from '@/components/terminal/TerminalStrip';
import ScarLogPanel from '@/components/sense/ScarLogPanel';
import TimeMachinePanel from '@/components/sense/TimeMachinePanel';

export default function Home() {
  return (
    <StoreStreamProvider>
      <SenseUiProvider>
        <main className="flex h-screen w-screen overflow-hidden bg-white">
          {/* LEFT — SENSE (46%) */}
          <section className="relative flex w-[46%] min-w-[580px] shrink-0 overflow-hidden">
            <Sidebar />
            <ChatPanel />
            <ScarLogPanel />
            <TimeMachinePanel />
          </section>

          {/* THE BLACK LINE — exact, 8px, full height, pure black */}
          <div className="w-[8px] shrink-0 bg-black" aria-hidden />

          {/* RIGHT — STORE + TERMINAL (fills rest) */}
          <section className="relative flex min-w-0 flex-1 flex-col">
            <StorePanel />
            <TerminalStrip />
          </section>
        </main>
      </SenseUiProvider>
    </StoreStreamProvider>
  );
}
