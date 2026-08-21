import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { PRODUCT_NAME } from "@/lib/store-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The listing's price-history sparkline is fed by REAL scrape data: every
// check SENSE runs on this product lands in scrape_history, so the chart is
// literally the collector's own history — empty until SENSE starts watching.
export async function GET() {
  try {
    const { rows } = await getPool().query<{ price: string; scraped_at: Date }>(
      `SELECT sh.price, sh.scraped_at
       FROM scrape_history sh
       JOIN watches w ON w.id = sh.watch_id
       WHERE w.product_name = $1
       ORDER BY sh.scraped_at ASC`,
      [PRODUCT_NAME],
    );
    return NextResponse.json({
      points: rows.map((r) => ({
        price: Number(r.price),
        at: r.scraped_at,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { points: [], error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
