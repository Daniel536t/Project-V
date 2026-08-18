import { NextResponse } from "next/server";
import { getTimeSeries } from "@/lib/db";

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

  try {
    const rows = await getTimeSeries(category);
    const points = rows
      .filter((r) => r.price !== null)
      .map((r) => ({ year: r.era, price: Number(r.price) }));
    return NextResponse.json({ category, points, source: "db" });
  } catch {
    // DB not wired up yet — return demo data so the timeline renders.
    return NextResponse.json({
      category,
      points: DEMO_POINTS,
      source: "demo",
      note: "DATABASE_URL not set — showing sample data.",
    });
  }
}
