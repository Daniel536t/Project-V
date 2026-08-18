"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/ask", label: "Ask" },
  { href: "/valuate", label: "Valuate" },
  { href: "/timeline/music", label: "Timeline" },
  { href: "/demo/healing", label: "Self-Healing" },
  { href: "/personal", label: "Personal" },
];

/** Comic top bar with a glitching ORACLE wordmark. */
export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="group flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span
            className="glitch font-display text-2xl tracking-wider text-foreground"
            data-text="ORACLE"
          >
            ORACLE
          </span>
          <span className="hidden font-display text-xs tracking-[0.25em] text-spider-blue sm:inline">
            INTO THE SCRAPE-VERSE
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 font-display text-lg tracking-wider transition ${
                  active
                    ? "bg-spider-red text-white shadow-[3px_3px_0_#05050a]"
                    : "text-foreground/80 hover:bg-panel hover:text-spider-pink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="rounded-lg border-2 border-black bg-panel px-3 py-1 font-display text-xl text-foreground md:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="flex flex-col gap-1 border-t-2 border-black bg-panel/95 p-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 font-display text-lg tracking-wider ${
                pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))
                  ? "bg-spider-red text-white"
                  : "text-foreground/85 hover:bg-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
