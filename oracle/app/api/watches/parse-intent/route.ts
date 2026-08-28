import { NextResponse } from "next/server";
import {
  parseIntentDeterministic,
  parseIntentNim,
  parseLiveIntentDeterministic,
  parseLiveIntentNim,
  parseExternalIntentDeterministic,
  parseCryptoIntentDeterministic,
  parseReleaseIntent,
  isAsk,
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

  // Crypto price watch — no URL needed ("alert me when Bitcoin goes above $120000")
  // → real CoinMarketCap page through the external collector pipeline.
  const crypto = parseCryptoIntentDeterministic(message);
  if (crypto) {
    return NextResponse.json(crypto);
  }

  // One-off question — SENSE answers it, no watch created. ChatPanel routes
  // "ask" to the agent chat path, which replies from real state (no LLM stall).
  if (isAsk(message)) {
    return NextResponse.json({ kind: "ask" });
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

  // Live semantic watch — DETERMINISTIC first. The NIM fallback must wait
  // until every cheap parser has had its turn, otherwise messages like
  // "tell me when GTA 6 presales open" pay a 25s LLM round-trip (and NIM's
  // HN extractor might hallucinate a live watch from them).
  const liveDet = parseLiveIntentDeterministic(message);
  if (liveDet) {
    return NextResponse.json(liveDet);
  }

  // Release / preorder intent without a URL — the agent will ask for the page
  // ("tell me when GTA 6 preorders open" → needs the product page URL).
  const release = parseReleaseIntent(message);
  if (release) {
    return NextResponse.json(release);
  }

  const live: LiveIntent | null = await parseLiveIntentNim(message);
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
