"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask the Oracle… e.g. “Should I buy a PS5 now or wait?”"
        aria-label="Ask the Oracle"
        className="w-full rounded-2xl border border-spider-red/40 bg-panel/80 px-6 py-4 pr-28 text-base text-foreground placeholder:text-foreground/40 shadow-[0_0_30px_rgba(255,45,85,0.25)] outline-none backdrop-blur transition focus:border-spider-red focus:shadow-[0_0_40px_rgba(255,45,85,0.45)]"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-spider-red px-5 py-2 font-display text-lg tracking-wider text-white transition hover:bg-spider-pink"
      >
        ASK
      </button>
    </form>
  );
}
