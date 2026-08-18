import { NextResponse } from "next/server";
import { llmRouter } from "@/lib/llm-router";
import { recordUserQuery } from "@/lib/db";

export const runtime = "nodejs";

interface AskBody {
  q?: string;
}

export async function POST(request: Request) {
  let body: AskBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const q = body.q?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  const { intent, model } = llmRouter.routeIntent(q);

  let answer: string;
  try {
    answer = await llmRouter.callLLM(
      model,
      `You are ORACLE, a Spider-Verse-themed web intelligence assistant with 25 years of scraped web data. Answer concisely and with confidence.\n\nQuestion: ${q}`,
      { system: "Answer as ORACLE. Cite the era/year when relevant." },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "LLM is not configured yet. Add NVIDIA_API_KEY or OPENROUTER_API_KEY to .env.local.",
        detail: err instanceof Error ? err.message : String(err),
        intent,
        model,
      },
      { status: 503 },
    );
  }

  // Analytics write is best-effort — never fail the request over it.
  try {
    await recordUserQuery(q, intent, { answer, model });
  } catch {
    // DB not wired up yet; ignore.
  }

  return NextResponse.json({ answer, intent, model });
}
