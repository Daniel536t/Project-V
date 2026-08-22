// lib/live.ts — LIVE watches: a real Bright Data collector against a real,
// fast-moving public URL (Hacker News). The scrape genuinely leaves the process:
// `bdata scraper run <collector_id> <url>` submits a real batch job on Bright
// Data and returns parsed rows. The diff/condition/alert engine in sense.ts is
// shared with the store path — only the "fetch" differs.

import { runCollectorCli } from "./brightdata";
import { callLLM } from "./llm-router";
import { MODELS } from "./constants";
import type { WatchRow } from "./db";

export const HN_NAME = "Hacker News";
export const HN_URL = "https://news.ycombinator.com";
export const HN_COLLECTOR_ID =
  process.env.BRIGHT_DATA_HN_COLLECTOR_ID ?? "c_mt443qoyivn3opd1i";

// HN runs go through Bright Data's async BATCH mode (the realtime page limit is
// exceeded), so each scrape is a submitted job polled to completion (~2–3 min).
// Match the scheduler cadence to that real latency.
export const LIVE_SCRAPE_INTERVAL_MS = 180 * 1000;

export interface HnStory {
  rank: number;
  title: string;
  url: string | null;
  points: number | null;
  comments: number | null;
}

export interface LiveScrapeOutcome {
  broke: boolean;
  reason?: string;
  stories: HnStory[];
  value: string | null; // rank of the top matching story (string, for the evaluator)
  matchedTitles: string[];
  raw: unknown;
}

function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "number") {
      if (Number.isFinite(v)) return v;
      continue;
    }
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function toStory(row: unknown): HnStory | null {
  if (row == null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const title = str(r.title, r.name, r.headline, r.story_title);
  if (!title) return null;
  return {
    rank: num(r.rank, r.position, r.number, r.index, r.no, r.order) ?? 0,
    title,
    url: str(r.url, r.link, r.href, r.story_url),
    points: num(r.points, r.score, r.upvotes, r.point),
    comments: num(r.comments, r.comment_count, r.comments_count, r.num_comments, r.descendants),
  };
}

/**
 * Normalize Bright Data's real HN envelope into a flat story list.
 *
 * Real shape (captured 2026-08-22):
 *   [{"stories":[{"title","url","points","comment_count"}],
 *     "product_page_url","input":{"url"}}, ...]
 *
 * The collector does not yet return the front-page `rank`, so rank is derived
 * as "position by points, descending" — an honest prominence proxy. When a
 * `rank` field is present (after the heal), it is honoured verbatim.
 */
export function normalizeStories(raw: unknown): HnStory[] {
  const rows: unknown[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        item &&
        typeof item === "object" &&
        Array.isArray((item as { stories?: unknown[] }).stories)
      ) {
        rows.push(...(item as { stories: unknown[] }).stories);
      } else {
        rows.push(item);
      }
    }
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const k of ["data", "result", "rows", "stories", "items", "output", "results"]) {
      if (Array.isArray(obj[k])) {
        rows.push(...(obj[k] as unknown[]));
        break;
      }
    }
  }

  const stories = rows.map(toStory).filter((s): s is HnStory => s !== null);
  // Sort by points desc (prominence), then assign a stable 1-based rank where missing.
  stories.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  stories.forEach((s, i) => {
    if (!s.rank) s.rank = i + 1;
  });
  return stories;
}

function keywordFallback(stories: HnStory[], topic: string): number[] {
  const terms = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  return stories
    .filter((s) => terms.some((t) => s.title.toLowerCase().includes(t)))
    .map((s) => s.rank);
}

/** NIM classification: which story ranks relate to `topic`. */
export async function classifyStoryRanks(stories: HnStory[], topic: string): Promise<number[]> {
  // Only the top stories can ever satisfy a "top N" condition — keep the
  // prompt small so the reasoning model's CoT doesn't swallow the answer.
  const top = stories.slice(0, 10);
  const lines = top.map((s) => `${s.rank} | ${s.title}`).join("\n");
  const prompt = [
    `Topic to detect: "${topic}"`,
    `Here are Hacker News front-page stories as "rank | title":`,
    lines,
    ``,
    `Return ONLY a JSON array of the integer ranks of stories that are about or closely related to the topic. If none match, return [].`,
  ].join("\n");

  try {
    const raw = await callLLM(MODELS.conversational, prompt, {
      system:
        "You are a classifier. Output ONLY a JSON array of integers, no explanation, no thinking, no markdown.",
      maxTokens: 1500,
      temperature: 0,
    });
    // This reasoning model puts its chain-of-thought in `content`, so the
    // final answer is the LAST `[...]` block of integers in the output.
    const re = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]|\[\s*\]/g;
    const matches = Array.from(raw.matchAll(re));
    if (matches.length === 0) {
      console.warn("classify: no integer array in NIM content", JSON.stringify(raw.slice(-200)));
      return [];
    }
    const last = matches[matches.length - 1][0];
    const arr = JSON.parse(last);
    return (Array.isArray(arr) ? arr : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch (e) {
    console.error("live classify NIM failed → keyword fallback", e);
    return keywordFallback(stories, topic);
  }
}

/** Run the real collector once and evaluate the semantic condition. */
export async function scrapeLiveWatch(watch: WatchRow): Promise<LiveScrapeOutcome> {
  const collectorId = watch.collector_id ?? HN_COLLECTOR_ID;
  const url = watch.url || HN_URL;

  const raw = await runCollectorCli(collectorId, url);
  if (raw == null) {
    return {
      broke: true,
      reason: "collector-error",
      stories: [],
      value: null,
      matchedTitles: [],
      raw: null,
    };
  }

  const stories = normalizeStories(raw);
  if (stories.length === 0) {
    return { broke: true, reason: "empty-extraction", stories: [], value: null, matchedTitles: [], raw };
  }

  const topic = watch.query;
  if (!topic) {
    return { broke: false, stories, value: null, matchedTitles: [], raw };
  }

  const ranks = await classifyStoryRanks(stories, topic);
  const matchedTitles = stories.filter((s) => ranks.includes(s.rank)).map((s) => s.title);
  const value = ranks.length ? String(Math.min(...ranks)) : null;

  return { broke: false, stories, value, matchedTitles, raw };
}
