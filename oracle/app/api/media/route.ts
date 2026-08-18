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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "this";

  // Best-effort DB lookup: image URLs + article links live in metadata JSONB.
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
    // DB not wired up yet — fall through to demo data.
  }

  return NextResponse.json({ query: q, items: demoItems(q), source: "demo" });
}

/** Sample era-tagged media so the collage renders before the DB is live. */
function demoItems(q: string): MediaItem[] {
  const years = [2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026];
  const templates = [
    (y: number) => `From the archives: ${q} (${y})`,
    (y: number) => `How ${q} looked in ${y}`,
    (y: number) => `The ${q} timeline — ${y} snapshot`,
    (y: number) => `${q}: what changed in ${y}`,
  ];

  return years.map((y, i) => ({
    era: y,
    title: templates[i % templates.length](y),
    image_url: `https://picsum.photos/seed/oracle-${y}-${i}/600/420`,
    article_url: `https://web.archive.org/web/${y}/https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    source: "demo",
    category: "general",
  }));
}
