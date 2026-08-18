"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import SpiderWeb, { type DataPoint } from "@/components/SpiderWeb";

export default function AskPage() {
  return (
    <Suspense fallback={<AnalyzingFallback />}>
      <AskContent />
    </Suspense>
  );
}

function AnalyzingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl">🕸️</div>
        <p className="text-xl">Analyzing dimensions…</p>
      </div>
    </div>
  );
}

function AskContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");

  const [answer, setAnswer] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(Boolean(query));

  useEffect(() => {
    if (query) {
      void fetchAnswer(query);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchAnswer(q: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, category: "general" }),
      });
      const result = await response.json();
      setAnswer(
        result.answer ?? result.error ?? "The Oracle is silent… try again.",
      );
      setData(toDataPoints(result.data?.historicalData));
    } catch (error) {
      console.error("Error:", error);
      setAnswer("Sorry, I encountered an error.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <AnalyzingFallback />;
  }

  if (!query) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="font-display text-2xl">Ask the Oracle</p>
          <p className="mt-2 text-foreground/60">
            Use the 🕸️ SENSE bubble to ask a question, or search from the home
            page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="mb-4 text-4xl">{query}</h1>
          <div className="rift"></div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="spider-panel mb-8"
        >
          <p className="text-lg leading-relaxed">{answer}</p>
        </motion.div>

        {data.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="mb-4 text-2xl">The Data Web</h2>
            <SpiderWeb data={data} width={800} height={800} />
          </motion.div>
        )}
      </div>
    </main>
  );
}

/**
 * Normalize raw scraped_data rows into the shape SpiderWeb expects.
 * Postgres DECIMAL comes back as a string, so coerce price/era to numbers.
 */
function toDataPoints(rows: unknown): DataPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      era: Number(row.era) || 0,
      category: typeof row.category === "string" ? row.category : "general",
      title: typeof row.title === "string" ? row.title : "",
      price: Number(row.price) || 0,
      availability:
        typeof row.availability === "string" ? row.availability : "unknown",
    };
  });
}
