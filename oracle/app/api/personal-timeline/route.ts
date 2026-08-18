import { NextResponse } from "next/server";
import { MODELS } from "@/lib/constants";
import { llmRouter } from "@/lib/llm-router";

export const runtime = "nodejs";

interface PersonalTimelineBody {
  events?: Array<{ year: number; label: string }>;
}

export async function POST(request: Request) {
  let body: PersonalTimelineBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const events = body.events ?? [];
  if (events.length === 0) {
    return NextResponse.json(
      { error: "No events provided" },
      { status: 400 },
    );
  }

  const prompt =
    "Turn these personal events into a Spider-Verse timeline story, one line each:\n" +
    events.map((e) => `- ${e.year}: ${e.label}`).join("\n");

  try {
    const timeline = await llmRouter.callLLM(
      MODELS.primary,
      prompt,
      { system: "Write punchy, comic-book narration." },
    );
    return NextResponse.json({ timeline, events });
  } catch (err) {
    return NextResponse.json(
      {
        error: "LLM is not configured yet. Add a key to .env.local.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
