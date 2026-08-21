import { NextResponse } from "next/server";
import { getScarLog, getTotalScarCount } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [scars, total] = await Promise.all([getScarLog(), getTotalScarCount()]);
    return NextResponse.json({ scars, total });
  } catch (e) {
    return NextResponse.json(
      { scars: [], total: 0, error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
