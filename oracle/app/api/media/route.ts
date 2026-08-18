import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db";

export const runtime = "nodejs";

export interface MediaItem {
  era: number;
  title: string;
  image_url: string;
  article_url: string;
  source: string;
  category: string;
}

const STOPWORDS = new Set([
  "how", "did", "what", "when", "where", "why", "who", "which",
  "is", "are", "was", "were", "the", "a", "an", "of", "in", "on",
  "at", "to", "for", "and", "or", "it", "this", "that", "about",
  "with", "without", "from", "by", "as", "i", "you", "he", "she",
  "we", "they", "me", "my", "your", "does", "do", "should", "would",
  "could", "can", "will", "evolve", "evolution", "evolved", "change",
  "changed", "become", "look", "like", "now", "then", "history",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "this";

  // 1) Best-effort DB lookup (real scraped media, once the DB is wired).
  try {
    const rows = await queryDatabase<Record<string, unknown>>(
      `SELECT era, title, source_url, metadata, category
       FROM scraped_data
       WHERE title ILIKE $1
         AND metadata->>'image_url' IS NOT NULL
       ORDER BY era ASC
       LIMIT 24`,
      [`%${q}%`],
    );

    if (rows.length > 0) {
      const items = rows
        .map((r) => {
          const meta = (r.metadata ?? {}) as Record<string, unknown>;
          return {
            era: Number(r.era) || 0,
            title: String(r.title ?? q),
            image_url: String(meta.image_url ?? ""),
            article_url: String(meta.article_url ?? r.source_url ?? ""),
            source: "db",
            category: String(r.category ?? "general"),
          };
        })
        .filter((i) => i.image_url);

      if (items.length > 0) {
        return NextResponse.json({ query: q, items, source: "db" });
      }
    }
  } catch {
    // DB not wired up yet — continue to Commons.
  }

  // 2) Query-relevant media from Wikimedia Commons (no key needed).
  try {
    const items = await commonsItems(q);
    if (items.length >= 3) {
      return NextResponse.json({ query: q, items, source: "commons" });
    }
  } catch {
    // fall through to placeholder imagery.
  }

  // 3) Last-resort placeholder imagery.
  return NextResponse.json({
    query: q,
    items: placeholderItems(q),
    source: "demo",
  });
}

async function commonsItems(q: string): Promise<MediaItem[]> {
  const kw = keyword(q);
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: kw,
      gsrnamespace: "6",
      gsrlimit: "16",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "600",
      format: "json",
      origin: "*",
    }).toString();

  const res = await fetchCommons(url);

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            thumburl?: string;
            url?: string;
            descriptionurl?: string;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages ?? {});
  const withImages = pages
    .map((p) => ({
      title: p.title ?? "",
      url: p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url ?? "",
      page: p.imageinfo?.[0]?.descriptionurl ?? "",
    }))
    .filter((x) => x.url);

  return withImages.slice(0, 14).map((x, i, arr) => ({
    era: 2000 + Math.round((i / Math.max(arr.length - 1, 1)) * 26),
    title: cleanTitle(x.title),
    image_url: x.url,
    article_url:
      x.page ||
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(
        x.title.replace(/ /g, "_"),
      )}`,
    source: "commons",
    category: "general",
  }));
}

async function fetchCommons(url: string): Promise<Response> {
  let last: Response | undefined;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "ORACLE/1.0 (Into-the-Scrape-Verse hackathon demo)",
      },
    });
    if (res.ok) return res;
    last = res;
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 900 * (i + 1)));
      continue;
    }
    break;
  }
  if (last) return last;
  throw new Error("commons fetch failed");
}

function keyword(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept = words.filter((w) => !STOPWORDS.has(w));
  return kept.length ? kept.slice(0, 2).join(" ") : q.trim();
}

function cleanTitle(t: string): string {
  return t
    .replace(/^File:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ");
}

function placeholderItems(q: string): MediaItem[] {
  const years = [2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026];
  return years.map((y, i) => ({
    era: y,
    title: `${q} — ${y} snapshot`,
    image_url: `https://picsum.photos/seed/oracle-${y}-${i}/600/420`,
    article_url: `https://web.archive.org/web/${y}/https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    source: "demo",
    category: "general",
  }));
}
