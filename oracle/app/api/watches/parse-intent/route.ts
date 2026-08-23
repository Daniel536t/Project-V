import { NextResponse } from "next/server";
import {
  parseIntentDeterministic,
  parseIntentNim,
  parseLiveIntentDeterministic,
  parseLiveIntentNim,
  parseExternalIntentDeterministic,
  type ParsedIntent,
  type LiveIntent,
} from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // External URL watch — any URL the user pastes ("watch amazon.com/...")
  const ext = parseExternalIntentDeterministic(message);
  if (ext) {
    return NextResponse.json({
      kind: "external",
      url: ext.url,
      label: ext.label,
      field: ext.field,
      operator: ext.operator,
      target: ext.target,
    });
  }

  // Order matters: the STORE deterministic parser runs FIRST — the demo's
  // primary flow ("alert me when the iPhone 17 Pro drops below $800") must
  // never pay an LLM round-trip. NIM is only consulted when both deterministic
  // parsers miss, so a slow/down NIM endpoint can never break watch creation.
  let parsed: ParsedIntent | null = parseIntentDeterministic(message);
  if (parsed) {
    return NextResponse.json({
      kind: "store",
      product_name: parsed.product_name,
      target_price: parsed.target_price,
      condition: parsed.condition,
      field: parsed.field,
    });
  }

  // Live semantic watch ("watch HN and alert me when an AI-agents story hits
  // the top 5") — deterministic first, NIM only for novel phrasing.
  const live: LiveIntent | null =
    parseLiveIntentDeterministic(message) ?? (await parseLiveIntentNim(message));
  if (live) {
    return NextResponse.json(live);
  }

  // NIM structured JSON as the authority for novel phrasing.
  parsed = await parseIntentNim(message);

  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse a watch request from that message" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    kind: "store",
    product_name: parsed.product_name,
    target_price: parsed.target_price,
    condition: parsed.condition,
    field: parsed.field,
  });
}
