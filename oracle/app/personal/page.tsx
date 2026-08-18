"use client";

import { useState, type FormEvent } from "react";
import TimelineCard from "@/components/TimelineCard";

interface PersonalEvent {
  year: number;
  label: string;
}

export default function PersonalPage() {
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [year, setYear] = useState(2010);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addEvent(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setEvents([...events, { year, label: label.trim() }].sort((a, b) => a.year - b.year));
    setLabel("");
  }

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/personal-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      const data = await res.json();
      setResult(data.timeline ?? data.error ?? "No timeline returned.");
    } catch {
      setResult("Failed to generate timeline.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-spider-blue">
        YOUR DIMENSION
      </p>
      <h1 className="chromatic mt-2 font-display text-5xl tracking-wide text-foreground">
        Personal timeline
      </h1>
      <span className="onomatopoeia onomatopoeia--pink mt-2 text-2xl">SPIN!</span>
      <p className="mt-3 text-foreground/60">
        Add milestones and let the Oracle spin them into your Spider-Verse
        origin story.
      </p>

      <form onSubmit={addEvent} className="mt-10 flex flex-wrap gap-3">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={2000}
          max={2026}
          className="w-28 rounded-xl border border-foreground/20 bg-ink px-4 py-2 text-foreground outline-none focus:border-spider-red"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Started my first company"
          className="flex-1 rounded-xl border border-foreground/20 bg-ink px-4 py-2 text-foreground outline-none focus:border-spider-red"
        />
        <button
          type="submit"
          className="rounded-xl bg-spider-red px-5 py-2 font-display tracking-wider text-white transition hover:bg-spider-pink"
        >
          ADD
        </button>
      </form>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {events.map((e, i) => (
          <TimelineCard
            key={i}
            year={e.year}
            title={e.label}
            description="A milestone in your dimension."
            accent="text-spider-blue"
          />
        ))}
      </div>

      {events.length > 0 && (
        <button
          onClick={generate}
          disabled={loading}
          className="mt-8 self-start rounded-xl bg-spider-purple px-6 py-3 font-display text-lg tracking-wider text-white transition hover:bg-spider-pink disabled:opacity-50"
        >
          {loading ? "SPINNING…" : "GENERATE MY TIMELINE"}
        </button>
      )}

      {result && (
        <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-foreground/10 bg-panel/80 p-5 text-sm leading-relaxed text-foreground/80">
          {result}
        </pre>
      )}
    </main>
  );
}
