import { NextResponse } from "next/server";
import { routeQuery } from "@/lib/llm-router";
import { queryDatabase, recordUserQuery } from "@/lib/db";

export const runtime = "nodejs";

interface AskBody {
  question?: string;
  /** Backward-compatible field name used by the existing chat widget. */
  q?: string;
  category?: string;
}

export async function POST(request: Request) {
  let body: AskBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body.question ?? body.q ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }
  const category = body.category?.trim() || null;

  // Fetch historical context. Best-effort: the DB may not be wired up yet,
  // so a failure here should not take down the LLM answer.
  let historicalData: unknown[] = [];
  let stats: unknown[] = [];
  try {
    historicalData = await queryDatabase(
      `SELECT * FROM scraped_data
       WHERE category = $1
       ORDER BY era ASC`,
      [category],
    );
    stats = await queryDatabase(
      `SELECT * FROM yearly_stats
       WHERE category = $1
       ORDER BY year ASC`,
      [category],
    );
  } catch (err) {
    console.warn(
      "Ask: historical context unavailable (DB not configured):",
      err instanceof Error ? err.message : err,
    );
  }

  let response;
  try {
    response = await routeQuery(question, undefined, {
      historicalData,
      stats,
    });
  } catch (err) {
    console.error("Ask API error:", err);
    return NextResponse.json(
      {
        error: "Failed to process question",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  // Analytics write is best-effort — never fail the request over it.
  try {
    await recordUserQuery(question, category ?? "chat", response);
  } catch {
    // DB not wired up yet; ignore.
  }

  return NextResponse.json(response);
}
