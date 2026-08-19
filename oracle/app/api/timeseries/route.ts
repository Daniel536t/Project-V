import { NextResponse } from "next/server";
import { queryDatabase, type ScrapedData } from "@/lib/db";

export const runtime = "nodejs";

const DEMO_POINTS = [
  { year: 2000, price: 12 },
  { year: 2004, price: 18 },
  { year: 2008, price: 44 },
  { year: 2012, price: 90 },
  { year: 2016, price: 210 },
  { year: 2020, price: 520 },
  { year: 2024, price: 760 },
  { year: 2026, price: 640 },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "default";
  const startYear = parseInt(searchParams.get("startYear") ?? "2000", 10);
  const endYear = parseInt(searchParams.get("endYear") ?? "2026", 10);

  try {
    const data = await queryDatabase<ScrapedData>(
      `SELECT era, category, title, price, availability, metadata
       FROM scraped_data
       WHERE category = $1 AND era BETWEEN $2 AND $3
       ORDER BY era ASC`,
      [category, startYear, endYear],
    );

    const points = data
      .filter((r) => r.price !== null)
      .map((r) => ({ year: r.era, price: Number(r.price) }));

    // DB is live but has no scraped history for this category yet — show the
    // clearly-labeled demo timeline until the collector fills it in.
    if (points.length === 0) {
      return NextResponse.json({
        data: [],
        points: DEMO_POINTS,
        source: "demo",
        category,
        note: "No scraped history for this category yet — showing sample data.",
      });
    }

    return NextResponse.json({ data, points, source: "db", category });
  } catch (err) {
    // DB not wired up yet — return demo data so the timeline renders.
    console.warn(
      "Timeseries: DB unavailable, returning demo data:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({
      data: [],
      points: DEMO_POINTS,
      source: "demo",
      category,
      note: "DATABASE_URL not set — showing sample data.",
    });
  }
}
