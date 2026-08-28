import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm-router";
import { MODELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VoiceInput {
  product_name: string;
  value: string;
  operator: string;
  target?: string | null;
  previous?: string | null;
  field: string;
  /** Everything the scrape fetched — the briefing reports all of it. */
  stock?: boolean | null;
  via?: string | null;
  elapsed_s?: number | null;
  collector_id?: string | null;
  detail?: string | null;
}

/**
 * SENSE's speaking register — the user asked for "Alfred style": composed,
 * courteous, thorough, faintly wry. SENSE is the only name it ever uses.
 */
const SENSE_REGISTER =
  "You are SENSE, a watchful agent with the composure of Alfred Pennyworth addressing Bruce Wayne — formal warmth, dry wit, zero panic. " +
  "You have just completed a surveillance task and are briefing Sir. " +
  "Rules: address the user once as 'Sir'; report the FACTS first (what was watched, the fresh reading, how it moved — previous → current — and where that leaves the target); " +
  "then one crisp recommendation; optionally close with a short wry aside. " +
  "Maximum 3 short sentences. Plain text only — no emojis, no markdown, no lists. " +
  "Never invent data that was not provided; if a fact is unknown, omit it. " +
  "You are SENSE — never call yourself anything else.";

/** One-line fact summary the LLM and the fallback both render from. */
function factSheet(input: VoiceInput): string {
  const facts = [
    `watching: ${input.product_name}`,
    `fresh reading: ${input.value}`,
    input.previous ? `previous reading: ${input.previous}` : null,
    input.target ? `target/threshold: ${input.target}` : null,
    `condition: ${input.operator} on ${input.field}`,
    input.stock != null ? `stock: ${input.stock ? "in stock" : "out of stock"}` : null,
    input.detail ? `matched: ${input.detail}` : null,
    input.via ? `source: ${input.via}` : null,
    input.elapsed_s != null ? `fetch time: ${input.elapsed_s}s` : null,
    input.collector_id ? `collector: ${input.collector_id}` : null,
  ].filter(Boolean);
  return facts.join("\n");
}

/**
 * Deterministic fallback — same register, same facts, zero latency. The demo
 * must never stall waiting for the LLM, so this is the floor of quality.
 */
function templateVoice(input: VoiceInput): string {
  const pv = parseFloat(input.value?.replace(/[^0-9.]/g, ""));
  const pt = input.target ? parseFloat(String(input.target).replace(/[^0-9.]/g, "")) : null;
  const pp = input.previous ? parseFloat(String(input.previous).replace(/[^0-9.]/g, "")) : null;
  const was = input.previous ? ` It read ${input.previous} at the last sweep.` : "";
  const via = input.via ? ` Fetched via ${input.via}${input.elapsed_s != null ? ` in ${input.elapsed_s}s` : ""}.` : "";

  if (input.field === "content") {
    return `Sir — the page has changed under our watch. It now reads "${input.value}", where before it said "${input.previous ?? "something else"}". I judged the difference worth your attention.${via}`;
  }
  if (input.field === "stock" || input.operator === "in_stock" || input.operator === "out_of_stock") {
    const back = /in stock/i.test(input.value ?? "") || input.operator === "in_stock";
    return back
      ? `Sir — ${input.product_name} is back in stock as of this sweep. If you mean to move, I would not dawdle.${via}`
      : `Sir — ${input.product_name} has gone out of stock, I'm afraid. I'll signal you the instant it returns.${via}`;
  }
  if (input.operator === "spike") {
    const pct = pp && pp > 0 ? Math.round(((pv - pp) / pp) * 100) : 0;
    return `Sir — a word of caution. ${input.product_name} has jumped from $${pp} to ${input.value} (+${pct}%), which reads to me as a correction rather than a clearance. I'd hold position and keep the watch trained on it.${via}`;
  }
  if (input.operator === "drop") {
    const pct = pp && pp > 0 ? Math.round(((pp - pv) / pp) * 100) : 0;
    return `Sir — ${input.product_name} has slipped from $${pp} to ${input.value} (−${pct}%). Notable, though your ${input.target ? `$${input.target} target` : "threshold"} lies further below. I shall keep sweeping.${via}`;
  }
  if (input.operator === "<" && pt != null && !isNaN(pt)) {
    const diff = pt - pv;
    return diff <= 10
      ? `Sir — it's at ${input.value}, a mere $${diff.toFixed(0)} from your $${pt} threshold. The watch nearly spoke sooner.`
      : `Sir — the moment has arrived. ${input.product_name} is at ${input.value}, which is $${diff.toFixed(0)} beneath your $${pt} target.${was}${input.stock != null ? (input.stock ? " In stock." : " Currently unavailable, mind you.") : ""} The watch did its work quietly.${via}`;
  }
  if (input.operator === ">" && pt != null && !isNaN(pt)) {
    return `Sir — ${input.product_name} has climbed to ${input.value}, now above your $${pt} ceiling.${was} I shall flag it again should it climb further.${via}`;
  }
  if (input.operator === "<=") {
    return `Sir — it has broken through. ${input.product_name} sits at ${input.value} against your ${input.target} threshold.${input.detail ? ` The match: "${input.detail}".` : ""} Your attention is requested.${via}`;
  }
  return `Sir — ${input.product_name} now reads ${input.value}.${was} I thought you'd want to know.${via}`;
}

/**
 * LLM briefing — NVIDIA NIM in SENSE's register. Falls back to the template
 * on any failure. Timeboxed: the alert card must never feel sluggish.
 */
async function llmVoice(input: VoiceInput): Promise<string | null> {
  try {
    // Router gives dual-key fallback + per-call timeout; voice uses a tight
    // 8s ceiling — the alert card is already on screen while this lands.
    const text = await callLLM(
      MODELS.conversational,
      `Brief Sir on this surveillance result:\n\n${factSheet(input)}\n\nYour briefing:`,
      { system: SENSE_REGISTER, maxTokens: 140, temperature: 0.7, timeoutMs: 8_000 },
    );
    const trimmed = text.trim();
    // Sanity: refuse empty or absurdly long answers.
    return trimmed && trimmed.length <= 600 ? trimmed : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as VoiceInput | null;
  if (!body || !body.product_name) {
    return NextResponse.json({ error: "missing product_name" }, { status: 400 });
  }

  const llm = await llmVoice(body);
  const voice = llm || templateVoice(body);
  return NextResponse.json({ voice, source: llm ? "llm" : "template" });
}
