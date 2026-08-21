import { NextResponse } from "next/server";
import { getWatch } from "@/lib/db";
import { healWatch } from "@/lib/heal";
import { runScrapePass } from "@/lib/sense";

export const runtime = "nodejs";

// Manual heal: runs the real heal flow (Bright Data CLI when configured,
// deterministic fallback otherwise), logs a scar, and re-scrapes.
// Same collector ID — that is the entire point.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const watch = await getWatch(params.id);
  if (!watch) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const heal = await healWatch(params.id);
    const run = await runScrapePass(params.id);
    return NextResponse.json({
      watch: run.watch,
      healed: true,
      heal: {
        new_selector: heal.newSelector,
        confidence: heal.confidence,
        source: heal.source,
        duration_ms: heal.durationMs,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
