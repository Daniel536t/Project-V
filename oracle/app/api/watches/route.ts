import { NextResponse } from "next/server";
import { getWatches } from "@/lib/db";
import { createWatchFromIntent, runScrapePass } from "@/lib/sense";
import { ensureScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureScheduler();
  try {
    const watches = await getWatches();
    return NextResponse.json({ watches });
  } catch (e) {
    return NextResponse.json(
      { watches: [], error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });
  try {
    const source: "store" | "live" = body.source === "live" ? "live" : "store";
    const watch = await createWatchFromIntent({
      label: body.label ?? "watch",
      url: body.url ?? "/api/store/html",
      intent: body.intent ?? body.original_intent ?? "",
      field: body.field === "stock" ? "stock" : body.field === "rank" ? "rank" : "price",
      operator: body.operator ?? body.condition ?? "<",
      target: body.target ?? body.target_price ?? null,
      query: body.query ?? null,
      source,
    });

    // Live watches scrape on Bright Data's batch cadence (~2–3 min): fire the
    // first pass async so the chat confirms immediately. Store watches scrape
    // instantly (in-process).
    if (source === "live") {
      void runScrapePass(watch.id);
      return NextResponse.json({ watch, alerted: false }, { status: 201 });
    }

    // First real scrape immediately so the watch shows a live price.
    const run = await runScrapePass(watch.id);
    return NextResponse.json({ watch: run.watch, alerted: run.alerted }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
