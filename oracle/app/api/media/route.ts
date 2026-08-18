import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db";
import {
  searchBrightData,
  type BrightImageResult,
} from "@/lib/brightdata";

export const runtime = "nodejs";

export interface MediaItem {
  /** Real year when known; null = live result with no historical date. */
  era: number | null;
  title: string;
  image_url: string;
  article_url: string;
  source: string;
  category: string;
}

export interface ArticleItem {
  title: string;
  url: string;
  description: string;
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
      const images = rows
        .map((r) => {
          const meta = (r.metadata ?? {}) as Record<string, unknown>;
          return {
            era: Number(r.era) || null,
            title: String(r.title ?? q),
            image_url: String(meta.image_url ?? ""),
            article_url: String(meta.article_url ?? r.source_url ?? ""),
            source: "db",
            category: String(r.category ?? "general"),
          };
        })
        .filter((i) => i.image_url);

      const articles = rows
        .map((r) => ({
          title: String(r.title ?? q),
          url: String(r.source_url ?? ""),
          description: "",
        }))
        .filter((a) => a.url);

      if (images.length > 0 || articles.length > 0) {
        return NextResponse.json({ query: q, images, articles, source: "db" });
      }
    }
  } catch {
    // DB not wired up yet — continue.
  }

  // 2) Bright Data SERP — search anything (images + articles).
  try {
    const serp = await searchBrightData(q);
    if (serp.images.length > 0 || serp.web.length > 0) {
      return NextResponse.json({
        query: q,
        images: toImageItems(serp.images, q),
        articles: serp.web.slice(0, 8),
        source: "brightdata",
      });
    }
  } catch (err) {
    console.warn(
      "media: Bright Data SERP unavailable, falling back to Commons:",
      err instanceof Error ? err.message : err,
    );
  }

  // 3) Wikimedia Commons fallback (query-relevant, no key needed).
  try {
    const items = await commonsItems(q);
    if (items.length >= 3) {
      return NextResponse.json({
        query: q,
        images: items,
        articles: items.slice(0, 6).map((i) => ({
          title: i.title,
          url: i.article_url,
          description: "",
        })),
        source: "commons",
      });
    }
  } catch {
    // fall through to placeholder imagery.
  }

  // 4) Last-resort placeholder imagery.
  return NextResponse.json({
    query: q,
    images: placeholderItems(q),
    articles: [],
    source: "demo",
  });
}

function toImageItems(imgs: BrightImageResult[], q: string): MediaItem[] {
  return imgs.slice(0, 14).map((im, i) => ({
    // Live search results are "now" — only stamp a year when the source
    // caption explicitly carries a date. Never fabricate one.
    era: extractYear(im.source, im.title),
    title: im.title || `${q} · result ${i + 1}`,
    image_url: im.url,
    article_url: im.source_url || im.url,
    source: "brightdata",
    category: "general",
  }));
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

  return withImages.slice(0, 14).map((x) => ({
    era: extractYear(x.title),
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

/** Extract a year from a caption only when it is a clear date (month+year,
 * © year, or (year)). This avoids false positives like model numbers. */
function extractYear(...texts: Array<string | null | undefined>): number | null {
  const months = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
  for (const t of texts) {
    if (!t) continue;
    const dated = t.match(
      new RegExp(
        `\\b(?:${months})[a-z]*\\.?\\s+\\d{1,2},?\\s+(19\\d{2}|20\\d{2})\\b`,
        "i",
      ),
    );
    if (dated) return Number(dated[1]);
    const labeled = t.match(/©\s*(19\d{2}|20\d{2})|\((19\d{2}|20\d{2})\)/);
    if (labeled) return Number(labeled[1] ?? labeled[2]);
  }
  return null;
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
  // Last-resort demo imagery — clearly labeled, no fake years.
  return Array.from({ length: 8 }, (_, i) => ({
    era: null,
    title: `${q} — result ${i + 1}`,
    image_url: `https://picsum.photos/seed/oracle-${i}-${q.length}/600/420`,
    article_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    source: "demo",
    category: "general",
  }));
}
