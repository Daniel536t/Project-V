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
    const source: "store" | "live" | "external" =
      body.source === "live" ? "live" : body.source === "external" ? "external" : "store";
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

    // Live + External watches: real Bright Data collectors with batch latency
    // (~2–3 min). Fire the first pass async so the chat confirms immediately.
    if (source === "live" || source === "external") {
      void runScrapePass(watch.id);
      return NextResponse.json({ watch, alerted: false }, { status: 201 });
    }

    // First real scrape immediately so the watch shows a live price. The alert
    // is suppressed on this pass: if the condition is already met, the chat
    // says so conversationally ("heads up") instead of firing a repeating
    // alert. conditionMet reports the raw evaluation for that message.
    const run = await runScrapePass(watch.id, { suppressAlert: true });
    return NextResponse.json(
      { watch: run.watch, alerted: run.conditionMet, conditionMet: run.conditionMet },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
