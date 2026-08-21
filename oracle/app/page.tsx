import Sidebar from '@/components/sense/Sidebar';
import ChatPanel from '@/components/sense/ChatPanel';
import StorePanel from '@/components/store/StorePanel';
import TerminalStrip from '@/components/terminal/TerminalStrip';

export default function Home() {
  return (
    <main className="h-screen w-screen flex overflow-hidden bg-white">
      {/* LEFT — SENSE (46%) */}
      <section className="w-[46%] min-w-[580px] flex shrink-0">
        <Sidebar />
        <ChatPanel />
      </section>

      {/* THE BLACK LINE — exact, 8px, full height, pure black */}
      <div className="w-[8px] bg-black shrink-0" aria-hidden />

      {/* RIGHT — STORE + TERMINAL (fills rest) */}
      <section className="flex-1 flex flex-col min-w-0 relative">
        <StorePanel />
        <TerminalStrip />
      </section>
    </main>
  );
}
