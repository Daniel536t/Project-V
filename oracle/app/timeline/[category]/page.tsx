"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import SpiderWeb, { type DataPoint } from "@/components/SpiderWeb";
import DimensionalSlider from "@/components/DimensionalSlider";
import PriceChart, { type PricePoint } from "@/components/PriceChart";
import TimelineCard from "@/components/TimelineCard";
import { slugify } from "@/lib/utils";

/** Synthesize a multi-dimensional web so the demo still looks like a web. */
function demoWebData(primary: string): DataPoint[] {
  const cats = [primary, "music", "toys", "anime", "cameras"]
    .filter((c, i, a) => a.indexOf(c) === i)
    .slice(0, 5);
  const years = [2000, 2004, 2008, 2012, 2016, 2020, 2024, 2026];
  const rows: DataPoint[] = [];
  cats.forEach((c, ci) => {
    years.forEach((y) => {
      rows.push({
        era: y,
        category: c,
        title: `${c} · ${y}`,
        price: Math.round(8 + (y - 2000) * 14 + ci * 22 + ((y * 7 + ci * 13) % 37)),
        availability: "in stock",
      });
    });
  });
  return rows;
}

export default function TimelineCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = decodeURIComponent(params?.category ?? "default");

  const [points, setPoints] = useState<PricePoint[]>([]);
  const [source, setSource] = useState<"db" | "demo" | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch(`/api/timeseries?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data) => {
        setPoints(data.points ?? []);
        setSource(data.source ?? null);
      })
      .catch(() => setPoints([]));
  }, [category]);

  const years = points.map((p) => p.year);
  const minYear = years.length ? Math.min(...years) : 2000;
  const maxYear = years.length ? Math.max(...years) : 2026;

  useEffect(() => {
    setSelectedYear(maxYear);
  }, [maxYear]);

  // Multi-category web (demo) or single-category from real rows (db).
  const webData: DataPoint[] = useMemo(() => {
    if (source === "db") {
      return points.map((p) => ({
        era: p.year,
        category,
        title: `${slugify(category)} ${p.year}`,
        price: p.price,
        availability: "unknown",
      }));
    }
    return demoWebData(category);
  }, [source, points, category]);

  // Auto-scrub (time travel) while playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSelectedYear((y) => (y >= maxYear ? minYear : y + 1));
    }, 420);
    return () => clearInterval(id);
  }, [playing, minYear, maxYear]);

  const visibleCards = points.filter((p) => p.year <= selectedYear).slice(-3);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="comic-bg" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-xl tracking-[0.3em] text-spider-red"
        >
          WHEN DID IT CHANGE?
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="chromatic mt-2 font-display text-5xl tracking-wide text-foreground"
        >
          {category}
        </motion.h1>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
          className="onomatopoeia--pink onomatopoeia mt-2 text-2xl"
        >
          WHAM!
        </motion.span>

        {source === "demo" && (
          <p className="mt-3 inline-block rounded-full border-2 border-black bg-spider-yellow px-3 py-1 font-display text-sm tracking-wider text-black shadow-[3px_3px_0_#05050a]">
            ⚠ DEMO DATA — connect a database for real history
          </p>
        )}

        {/* Time machine */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="comic-panel comic-panel--tilt mt-10"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="relative h-20 w-32 sm:w-40">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={selectedYear}
                  initial={{ opacity: 0, scale: 1.6, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  data-text={String(selectedYear)}
                  className="glitch chromatic absolute left-0 top-0 font-display text-6xl text-black"
                >
                  {selectedYear}
                </motion.span>
              </AnimatePresence>
            </div>

            <button
              onClick={() => setPlaying((p) => !p)}
              className="comic-btn shrink-0"
            >
              {playing ? "⏸ Pause" : "▶ Time Travel"}
            </button>
          </div>

          <div className="mt-2">
            <DimensionalSlider
              min={minYear}
              max={maxYear}
              value={selectedYear}
              onChange={setSelectedYear}
            />
          </div>
        </motion.div>

        {/* Charts */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <div className="rounded-2xl border-2 border-black bg-panel/90 p-4 shadow-[6px_6px_0_#05050a]">
            <h3 className="mb-2 font-display text-xl tracking-wider text-spider-blue">
              🕸️ THE SCRAPE-VERSE WEB
            </h3>
            <SpiderWeb data={webData} selectedYear={selectedYear} />
          </div>

          <div className="rounded-2xl border-2 border-black bg-panel/90 p-4 shadow-[6px_6px_0_#05050a]">
            <h3 className="mb-2 font-display text-xl tracking-wider text-spider-red">
              📈 PRICE ACROSS ERAS
            </h3>
            <PriceChart data={points} />
          </div>
        </motion.div>

        {/* Inflection points */}
        <div className="mt-12">
          <h2 className="chromatic mb-5 text-3xl">⚡ Inflection Points</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {visibleCards.map((p) => (
                <motion.div
                  key={p.year}
                  layout
                  initial={{ opacity: 0, scale: 0.85, y: 24, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -16 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                >
                  <TimelineCard
                    year={p.year}
                    title={`${slugify(category)} ${p.year}`}
                    description={`Avg price around this era. Source: ${
                      source ?? "—"
                    }.`}
                    accent="text-spider-red"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
