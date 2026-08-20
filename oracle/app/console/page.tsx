"use client";

import Link from "next/link";
import WatchList from "@/components/WatchList";

export default function ConsolePage() {
  return (
    <div className="relative min-h-screen bg-[#07070b] font-sans text-white">
      <div className="aurora" />
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-tight">Watches</p>
            <p className="mt-1 text-sm text-white/45">
              The machinery behind SENSE — every watch, its check loop, and its
              scars.
            </p>
          </div>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← SENSE
          </Link>
        </header>
        <section className="mt-8">
          <WatchList />
        </section>
      </main>
    </div>
  );
}
