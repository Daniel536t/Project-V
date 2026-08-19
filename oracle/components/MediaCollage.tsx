"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface MediaItem {
  era: number | null;
  datedBy?: "caption" | "wayback" | "db" | null;
  title: string;
  image_url: string;
  article_url: string;
  source: string;
  category: string;
  domain: string;
}

interface ArticleItem {
  title: string;
  url: string;
  description: string;
  domain: string;
}

interface MediaResponse {
  images?: MediaItem[];
  articles?: ArticleItem[];
  source?: string;
}

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="100%" height="100%" fill="#12122a"/><text x="50%" y="50%" font-size="110" text-anchor="middle" dominant-baseline="central">🕸️</text></svg>`,
  );

const SOURCE_LABEL: Record<string, string> = {
  brightdata: "POWERED BY BRIGHT DATA",
  db: "SCRAPED ARCHIVE",
  commons: "WIKIMEDIA COMMONS",
  demo: "DEMO DATA",
};

/** Grade an image by era: faded/sepia in the past, vivid in the present.
 * Live results (no real date) stay vivid — we never fake aging. */
function eraFilter(era: number | null): string {
  if (era == null) return "saturate(1.1)";
  if (era <= 2006) return "grayscale(0.7) sepia(0.45) contrast(1.05)";
  if (era <= 2014) return "sepia(0.2) saturate(0.9)";
  return "saturate(1.15)";
}

/** The "multiverse collage" of a query across time — images + related articles. */
export default function MediaCollage({ query }: { query: string }) {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  // A new query starts from the cache again.
  useEffect(() => {
    setRefresh(false);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/media?q=${encodeURIComponent(query)}&refresh=${refresh ? "1" : "0"}`,
    )
      .then((r) => r.json())
      .then((d: MediaResponse) => {
        if (cancelled) return;
        setImages(d.images ?? []);
        setArticles(d.articles ?? []);
        setSource(d.source ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setImages([]);
          setArticles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, refresh]);

  if (loading) {
    return (
      <div className="mt-12 flex items-center gap-3 text-foreground/60">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-spider-pink border-t-transparent" />
        Searching the multiverse…
      </div>
    );
  }

  if (images.length === 0 && articles.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="chromatic font-display text-3xl">
            🌐 MULTIVERSE COLLAGE
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            “{query}” —{" "}
            {source === "db" ? "across the scraped archive" : "live search results"}
            . Click a panel to open its source.
            {images.some((i) => i.datedBy === "wayback") &&
              " ≈ years are first-capture dates from the Wayback Machine."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setRefresh((r) => !r)}
            disabled={loading}
            title="Re-search the multiverse (bypasses cache)"
            className="inline-block rounded-full border-2 border-black bg-spider-yellow px-3 py-1 font-display text-xs tracking-wider text-black shadow-[3px_3px_0_#05050a] transition hover:brightness-110 disabled:opacity-60"
          >
            ⟳ REFRESH
          </button>
          <span className="inline-block rounded-full border-2 border-black bg-spider-blue px-3 py-1 font-display text-xs tracking-wider text-black shadow-[3px_3px_0_#05050a]">
            {SOURCE_LABEL[source] ?? source}
            {images.length > 0 ? ` · ${images.length} IMAGES` : ""}
            {articles.length > 0 ? ` · ${articles.length} ARTICLES` : ""}
          </span>
        </div>
      </div>

      <div className="rift my-5" />

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((it, i) => {
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

                <span
                  className="absolute left-1.5 top-1.5 rounded-md border-2 border-black bg-spider-yellow px-2 py-0.5 font-display text-sm tracking-wider text-black shadow-[2px_2px_0_#05050a]"
                  title={
                    it.datedBy === "wayback"
                      ? "First captured by the Wayback Machine in this year"
                      : it.era != null
                        ? "Year from the source"
                        : "Live result — no historical date"
                  }
                >
                  {it.era != null
                    ? it.datedBy === "wayback"
                      ? `≈${it.era}`
                      : it.era
                    : "LIVE"}
                </span>

                <span className="halftone pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay" />

                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/85 px-3 py-2 text-xs font-semibold text-white transition-transform duration-200 group-hover:translate-y-0">
                  {it.domain ? `${it.domain} · ${it.title}` : it.title}
                </span>
              </motion.a>
            );
          })}
        </div>
      )}

      {articles.length > 0 && (
        <div className="mt-10">
          <h3 className="chromatic mb-4 text-2xl">📰 Related Articles</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {articles.map((a, i) => (
              <motion.a
                key={`${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="group block rounded-xl border-2 border-black bg-panel p-4 shadow-[4px_4px_0_#05050a] transition hover:border-spider-pink"
              >
                <span className="block font-display text-lg leading-tight text-foreground group-hover:text-spider-pink">
                  {a.title}
                </span>
                {a.domain && (
                  <span className="mt-1 inline-block rounded border-2 border-black bg-spider-blue px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-black">
                    {a.domain}
                  </span>
                )}
                {a.description && (
                  <span className="mt-1 block text-sm text-foreground/60 line-clamp-2">
                    {a.description}
                  </span>
                )}
              </motion.a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
