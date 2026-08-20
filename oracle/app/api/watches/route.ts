import { NextResponse } from "next/server";
import { getWatches } from "@/lib/db";
import { createWatchFromIntent } from "@/lib/sense";
import { ensureScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";

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
  if (!body) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const watch = await createWatchFromIntent({
      label: body.label ?? "watch",
      url: body.url ?? "/demo/target",
      intent: body.intent ?? body.label ?? "",
      field: body.field === "stock" ? "stock" : "price",
      operator: body.operator ?? "<",
      target: body.target ?? null,
    });
    return NextResponse.json({ watch }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
