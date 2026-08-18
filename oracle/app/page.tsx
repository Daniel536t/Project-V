"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import SpiderVerseBackground from "@/components/SpiderVerseBackground";
import { QUESTION_TYPES } from "@/lib/constants";

const TRENDING = [
  { title: "When did vinyl outsell CDs?", category: "music", fx: "POW!" },
  { title: "Is this LEGO set actually rare?", category: "toys", fx: "WOW!" },
  { title: "The exact month anime went mainstream", category: "anime", fx: "ZAP!" },
];

const tilt = ["comic-panel--tilt", "", "comic-panel--tilt-r"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    if (query) router.push(`/ask?q=${encodeURIComponent(query)}`);
  };
  const handlePersonalTimeline = () => {
    if (birthYear) router.push(`/personal?year=${encodeURIComponent(birthYear)}`);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <SpiderVerseBackground />
      <div className="comic-bg" />
      <div className="speedlines absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-lg tracking-[0.35em] text-spider-blue"
          >
            INTO THE SCRAPE-VERSE
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
            data-text="ORACLE"
            className="glitch chromatic--hard relative mt-2 font-display text-[clamp(4.5rem,18vw,11rem)] leading-none text-foreground"
          >
            ORACLE
          </motion.h1>

          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 220 }}
            className="onomatopoeia -mt-3 text-5xl"
          >
            THWIP!
          </motion.span>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-3 max-w-2xl text-lg text-foreground/70"
          >
            25 years of scraped web data. Zero gaps. Infinite answers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rift mt-6 w-full max-w-md"
          />
        </section>

        {/* Search */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-14 max-w-2xl"
        >
          <div className="comic-panel comic-panel--tilt scanlines">
            <h2 className="mb-4 text-3xl">What do you want to know?</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="When did anime explode? Should I buy this camera?"
                className="flex-1 rounded-lg border-2 border-black bg-gray-100 px-4 py-3 text-black focus:border-spider-red focus:outline-none"
              />
              <button className="comic-btn" onClick={handleSearch}>
                Ask →
              </button>
            </div>
            <div className="my-3 text-center text-sm font-bold text-gray-500">
              — or —
            </div>
            <button
              className="comic-btn comic-btn--cyan w-full justify-center"
              onClick={() => router.push("/valuate")}
            >
              📸 Upload a Photo
            </button>
          </div>
        </motion.section>

        {/* Question types */}
        <section className="mt-24">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-10 text-center text-4xl"
          >
            Three ways to see the past
          </motion.h2>
          <div className="grid gap-8 md:grid-cols-3">
            {QUESTION_TYPES.map((q, i) => (
              <motion.div
                key={q.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <div className={`comic-panel ${tilt[i]} h-full`}>
                  <div className="text-5xl">{q.icon}</div>
                  <h3 className="mt-3 text-2xl">{q.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{q.description}</p>
                  <p className="mt-4 border-t-2 border-dashed border-gray-300 pt-3 text-sm italic text-gray-500">
                    “{q.example}”
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trending + demo CTA + personal */}
        <section className="mt-24 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-3xl">🔥 Trending This Week</h2>
            <div className="space-y-5">
              {TRENDING.map((s, i) => (
                <motion.div
                  key={s.category}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    href={`/timeline/${s.category}`}
                    className="comic-panel comic-panel--cyan flex items-center justify-between gap-4"
                  >
                    <div>
                      <h3 className="text-xl leading-tight">{s.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-gray-500">
                        Explore the {s.category} timeline →
                      </p>
                    </div>
                    <span className="onomatopoeia--pink onomatopoeia text-2xl">
                      {s.fx}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Link href="/demo/healing" className="comic-panel comic-panel--purple block">
                <span className="onomatopoeia--cyan onomatopoeia text-2xl">
                  ZZZT!
                </span>
                <h2 className="mt-2 text-3xl leading-tight">
                  🕸️ Watch it heal itself
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  A scraper breaks in 2010. One sentence later, the AI fixes it
                  — same collector, zero downtime.
                </p>
                <span className="comic-btn mt-4 inline-flex">
                  Run the Self-Healing Demo →
                </span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="comic-panel comic-panel--tilt-r">
                <h2 className="text-3xl">🕸️ Your Personal Timeline</h2>
                <p className="mt-1 text-sm text-gray-600">
                  See what changed in your lifetime.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="Birth year"
                    className="flex-1 rounded-lg border-2 border-black bg-gray-100 px-4 py-2 text-black focus:border-spider-red focus:outline-none"
                  />
                  <button className="comic-btn" onClick={handlePersonalTimeline}>
                    Generate
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <footer className="mt-24 text-center text-sm text-foreground/40">
          ORACLE · WeMakeDevs “Into the Scrape-Verse” hackathon
        </footer>
      </div>
    </main>
  );
}
