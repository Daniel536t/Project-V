"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SpiderWeb, { type DataPoint } from "@/components/SpiderWeb";
import DimensionalSlider from "@/components/DimensionalSlider";
import PriceChart, { type PricePoint } from "@/components/PriceChart";
import TimelineCard from "@/components/TimelineCard";
import { slugify } from "@/lib/utils";

export default function TimelineCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = decodeURIComponent(params?.category ?? "default");

  const [points, setPoints] = useState<PricePoint[]>([]);
  const [source, setSource] = useState<"db" | "demo" | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);

  useEffect(() => {
    fetch(`/api/timeseries?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data) => {
        setPoints(data.points ?? []);
        setSource(data.source ?? null);
      })
      .catch(() => setPoints([]));
  }, [category]);

  const spiderData: DataPoint[] = points.map((p) => ({
    era: p.year,
    category,
    title: `${slugify(category)} ${p.year}`,
    price: p.price,
    availability: "unknown",
  }));

  const years = points.map((p) => p.year);
  const minYear = years.length ? Math.min(...years) : 2000;
  const maxYear = years.length ? Math.max(...years) : 2026;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-spider-red">
        WHEN DID IT CHANGE?
      </p>
      <h1 className="chromatic mt-2 font-display text-5xl tracking-wide text-foreground">
        {category}
      </h1>
      <span className="onomatopoeia--pink onomatopoeia mt-2 text-2xl">WHAM!</span>
      {source === "demo" && (
        <p className="mt-3 text-sm text-spider-yellow">
          ⚠ Showing demo data — set DATABASE_URL to query real scraped history.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-foreground/10 bg-panel/60 p-4">
        <DimensionalSlider
          min={minYear}
          max={maxYear}
          defaultValue={maxYear}
          onChange={setSelectedYear}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="aspect-square rounded-2xl border border-foreground/10 bg-panel/60 p-4">
          <SpiderWeb data={spiderData} />
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-panel/60 p-4">
          <PriceChart data={points} />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {points
          .filter((p) => p.year <= selectedYear)
          .slice(-3)
          .map((p) => (
            <TimelineCard
              key={p.year}
              year={p.year}
              title={`${slugify(category)} ${p.year}`}
              description={`Avg price around this era. Source: ${
                source ?? "—"
              }.`}
            />
          ))}
      </div>
    </main>
  );
}
