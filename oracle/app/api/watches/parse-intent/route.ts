import { NextResponse } from "next/server";
import { parseIntentDeterministic, parseIntentNim, type ParsedIntent } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Deterministic first (instant + reliable for the demo); NIM structured
  // JSON is the authority for novel phrasing.
  let parsed: ParsedIntent | null = parseIntentDeterministic(message);
  if (!parsed) parsed = await parseIntentNim(message);

  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse a watch request from that message" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    product_name: parsed.product_name,
    target_price: parsed.target_price,
    condition: parsed.condition,
    field: parsed.field,
  });
}
