"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface MediaItem {
  era: number;
  title: string;
  image_url: string;
  article_url: string;
  source: string;
  category: string;
}

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="100%" height="100%" fill="#12122a"/><text x="50%" y="50%" font-size="110" text-anchor="middle" dominant-baseline="central">🕸️</text></svg>`,
  );

/** Grade an image by era: faded/sepia in the past, vivid in the present. */
function eraFilter(era: number): string {
  if (era <= 2006) return "grayscale(0.7) sepia(0.45) contrast(1.05)";
  if (era <= 2014) return "sepia(0.2) saturate(0.9)";
  return "saturate(1.15)";
}

/** A wall of era-tagged images — the "multiverse collage" of a query across time. */
export default function MediaCollage({ query }: { query: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) {
    return (
      <div className="mt-12 flex items-center gap-3 text-foreground/60">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-spider-pink border-t-transparent" />
        Opening the multiverse…
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="chromatic font-display text-3xl">
            🌐 MULTIVERSE COLLAGE
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            “{query}” — surfacing across 26 years. Click a panel to step into
            its era.
          </p>
        </div>
        <span className="onomatopoeia--cyan onomatopoeia hidden text-2xl sm:block">
          ZZZT!
        </span>
      </div>

      <div className="rift my-5" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it, i) => {
          const tilt = ((i % 5) - 2) * 2;
          return (
            <motion.a
              key={`${it.era}-${i}`}
              href={it.article_url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.4, rotate: tilt * 4 }}
              animate={{ opacity: 1, scale: 1, rotate: tilt }}
              transition={{
                delay: i * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 18,
              }}
              whileHover={{ scale: 1.06, rotate: 0, zIndex: 10 }}
              className="group relative block overflow-hidden rounded-xl border-[3px] border-black bg-panel shadow-[5px_5px_0_#05050a]"
            >
              <motion.span
                className="block"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 4 + (i % 4),
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.image_url}
                  alt={it.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PLACEHOLDER;
                  }}
                  className="aspect-[4/3] w-full object-cover"
                  style={{ filter: eraFilter(it.era) }}
                />
              </motion.span>

              {/* Era badge */}
              <span className="absolute left-1.5 top-1.5 rounded-md border-2 border-black bg-spider-yellow px-2 py-0.5 font-display text-sm tracking-wider text-black shadow-[2px_2px_0_#05050a]">
                {it.era}
              </span>

              {/* Comic halftone over the photo */}
              <span className="halftone pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay" />

              {/* Title slide-up */}
              <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/85 px-3 py-2 text-xs font-semibold text-white transition-transform duration-200 group-hover:translate-y-0">
                {it.title}
              </span>
            </motion.a>
          );
        })}
      </div>
    </section>
  );
}
