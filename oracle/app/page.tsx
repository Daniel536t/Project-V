"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import SpiderVerseBackground from "@/components/SpiderVerseBackground";

export default function Home() {
  const [query, setQuery] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    if (query) {
      router.push(`/ask?q=${encodeURIComponent(query)}`);
    }
  };

  const handlePersonalTimeline = () => {
    if (birthYear) {
      router.push(`/personal?year=${encodeURIComponent(birthYear)}`);
    }
  };

  return (
    <main className="relative min-h-screen">
      <SpiderVerseBackground />
      <div className="comic-bg"></div>

      <div className="container relative z-10 mx-auto px-4 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <h1 className="glitch mb-4 text-7xl" data-text="ORACLE">
            ORACLE
          </h1>
          <p className="mb-8 text-xl text-gray-400">
            25 years of web data. Zero gaps. Infinite answers.
          </p>

          <div className="rift mx-auto mb-8 max-w-md"></div>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-16 max-w-2xl"
        >
          <div className="spider-panel">
            <h2 className="mb-4 text-2xl">What do you want to know?</h2>

            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="When did anime explode? Should I buy this camera?"
                className="flex-1 rounded border-2 border-gray-300 bg-gray-100 px-4 py-3 text-black focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                className="rounded bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700"
              >
                Ask →
              </button>
            </div>

            <div className="mb-2 text-center text-gray-600">or</div>

            <button
              onClick={() => router.push("/valuate")}
              className="w-full rounded bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700"
            >
              📸 Upload a Photo
            </button>
          </div>
        </motion.div>

        {/* Trending Stories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-auto mb-16 max-w-4xl"
        >
          <h2 className="mb-6 text-center text-3xl">🔥 Trending This Week</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "When did vinyl outsell CDs?", category: "music" },
              { title: "Is this LEGO set actually rare?", category: "toys" },
              { title: "The exact month anime went mainstream", category: "anime" },
            ].map((story, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05 }}
                className="spider-panel cursor-pointer"
                onClick={() => router.push(`/timeline/${story.category}`)}
              >
                <h3 className="mb-2 text-lg font-bold">{story.title}</h3>
                <p className="text-sm text-gray-600">Click to explore →</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Personal Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mx-auto max-w-md"
        >
          <div className="spider-panel text-center">
            <h2 className="mb-4 text-2xl">🕸️ Your Personal Timeline</h2>
            <p className="mb-4 text-gray-600">
              See what changed in your lifetime
            </p>

            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="Enter your birth year"
              className="mb-4 w-full rounded border-2 border-gray-300 bg-gray-100 px-4 py-2 text-black focus:border-red-500 focus:outline-none"
            />

            <button
              onClick={handlePersonalTimeline}
              className="w-full rounded bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700"
            >
              Generate My Timeline
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
