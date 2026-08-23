import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

interface VoiceInput {
  product_name: string;
  value: string;
  operator: string;
  target?: string | null;
  previous?: string | null;
  field: string;
}

/**
 * Template fallback — fast, deterministic, always available. Returns a
 * one-sentence companion opinion for each alert type.
 */
function templateVoice(input: VoiceInput): string {
  const pv = parseFloat(input.value?.replace(/[^0-9.]/g, ""));
  const pt = input.target ? parseFloat(String(input.target).replace(/[^0-9.]/g, "")) : null;
  const pp = input.previous ? parseFloat(String(input.previous).replace(/[^0-9.]/g, "")) : null;

  if (input.operator === "spike") {
    const pct = pp && pp > 0 ? Math.round(((pv - pp) / pp) * 100) : 0;
    return `⚠️ Boss — ${input.product_name} just jumped from $${pp} to $${input.value} (+${pct}%). This looks like a price correction, not a sale ending. Hold off.`;
  }
  if (input.operator === "drop") {
    const pct = pp && pp > 0 ? Math.round(((pp - pv) / pp) * 100) : 0;
    return `📉 ${input.product_name} dropped $${pp} → $${input.value} (−${pct}%). Keep watching — the trend is your friend.`;
  }
  if (input.operator === "<" && pt != null && !isNaN(pt)) {
    const diff = pt - pv;
    if (diff <= 10) {
      return `It's at $${input.value} — just $${diff.toFixed(0)} from your $${pt} target. Been tracking it closely.`;
    }
    return `${input.product_name} hit $${input.value}. That's $${diff.toFixed(0)} under your $${pt} target. Solid catch.`;
  }
  if (input.operator === ">" && pt != null && !isNaN(pt)) {
    return `${input.product_name} is now $${input.value} — above your $${pt} threshold. Worth watching if it climbs further.`;
  }
  return `${input.product_name} is now ${input.value}. Hey — I noticed this change. Want me to set a target on it?`;
}

/**
 * LLM voice — calls NVIDIA NIM for a one-sentence companion judgment.
 * Falls back to the template on any failure. Timebox: 3 seconds.
 */
async function llmVoice(input: VoiceInput): Promise<string | null> {
  if (!NVIDIA_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta/llama-3.3-70b-instruct",
          messages: [
            {
              role: "user",
              content: `You are a sharp, concise shopping companion named SENSE. You just detected a price change. Give ONE sentence of advice — conversational, a bit opinionated, never robotic. No emojis, no markdown. Here's the data:\n\nProduct: ${input.product_name}\nCurrent price: ${input.value}\nPrevious price: ${input.previous ?? "unknown"}\nAlert type: ${input.operator}\nTarget: ${input.target ?? "none"}\nField: ${input.field}\n\nYour one sentence:`,
            },
          ],
          temperature: 0.8,
          max_tokens: 80,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    clearTimeout(timer);
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