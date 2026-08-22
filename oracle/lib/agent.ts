// SENSE agent — the only place an LLM is used is intent extraction (structured
// JSON output). Everything else is templated responses driven by real API state.
// We use NVIDIA NIM (lib/llm-router.ts) for the LLM — not OpenRouter.

import { callLLM } from "./llm-router";
import { MODELS } from "./constants";
import { createWatchFromIntent, runScrapePass, type RunResult } from "./sense";
import { deleteWatch, getWatches, type WatchRow } from "./db";

const STORE_URL = "/api/store/html";

export interface ParsedIntent {
  product_name: string;
  target_price: number | null;
  condition: string; // "<", "<=", ">", ">=", "==", "in_stock", "out_of_stock"
  field: "price" | "stock";
}

// ---- deterministic parser (fast path + fallback) ----

export function parseIntentDeterministic(msg: string): ParsedIntent | null {
  const m = msg.trim();
  const wantsWatch = /(watch|track|monitor|tell me when|alert me|notify|ping me|let me know)/i.test(m);
  const hasTarget = /(under|below|less than|drops?\s+to|hits?|when.*(stock|available))/i.test(m);

  if (!wantsWatch && !hasTarget) return null;

  const field: "price" | "stock" = /(stock|available|availability|restock|back in)/i.test(m)
    ? "stock"
    : "price";

  if (field === "stock") {
    const condition = /(out of|sold out|gone|unavailable)/i.test(m) ? "out_of_stock" : "in_stock";
    return { product_name: "iPhone 17 Pro", target_price: null, condition, field };
  }

  // price: "drops below $120" → target 120, condition "<"
  const explicit = m.match(
    /(?:under|below|less than|over|above|more than|drops?\s+to|hits?|at|==)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  );
  let target: number | null = null;
  let condition = "<";
  if (explicit) {
    target = Number(explicit[1]);
    if (/(over|above|more than)/i.test(explicit[0])) condition = ">";
    else if (/==|exactly/i.test(explicit[0])) condition = "==";
    else condition = "<";
  } else {
    const dollar = m.match(/\$\s*(\d+(?:\.\d+)?)/);
    target = dollar ? Number(dollar[1]) : null;
  }

  if (target == null) return null;
  return { product_name: "iPhone 17 Pro", target_price: target, condition, field };
}

// ---- NIM structured-JSON parser ----

function nimSystemPrompt(): string {
  return (
    "Extract a watch request from the user message into JSON with exactly these keys:\n" +
    '{"product_name": string, "target_price": number|null, "condition": string, "field": "price"|"stock"}\n' +
    '- product_name: the product being watched (e.g. "iPhone 17 Pro").\n' +
    '- target_price: the numeric threshold, or null for stock watches.\n' +
    '- condition: one of "<", "<=", ">", ">=", "==", "in_stock", "out_of_stock".\n' +
    '- field: "price" if it is a price threshold, "stock" if it is about availability.\n' +
    'Respond with ONLY the JSON object — no prose, no markdown fences.'
  );
}

export async function parseIntentNim(msg: string): Promise<ParsedIntent | null> {
  try {
    const raw = await callLLM(MODELS.conversational, msg, {
      system: nimSystemPrompt(),
      maxTokens: 300,
      temperature: 0,
    });
    const json = raw.replace(/```(?:json)?/gi, "").trim();
    const start = json.indexOf("{");
    const end = json.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(json.slice(start, end + 1)) as {
      product_name?: string;
      target_price?: number | null;
      condition?: string;
      field?: string;
    };
    const condition = String(obj.condition ?? "<");
    const field = obj.field === "stock" ? "stock" : "price";
    return {
      product_name: obj.product_name ?? "iPhone 17 Pro",
      target_price: obj.target_price ?? null,
      condition,
      field,
    };
  } catch {
    return null;
  }
}

// ---- entry point ----

export interface AgentReply {
  action: string;
  message: string;
  watch?: WatchRow;
  watches?: WatchRow[];
  alert?: WatchRow;
  events?: string[];
  parsed?: ParsedIntent;
}

export async function handleAgentMessage(msg: string): Promise<AgentReply> {
  const trimmed = msg.trim();
  const watches = await getWatches();

  // Convenience intents (not LLM).
  if (/^(list|show)\b/i.test(trimmed) || /what (am i|are you) watching/i.test(trimmed)) {
    if (watches.length === 0) {
      return { action: "list", message: "You're not watching anything yet.", watches };
    }
    const lines = watches.map((w) => `• ${w.id} — ${w.label ?? w.product_name ?? w.url} (${w.status})`);
    return {
      action: "list",
      message: `You're watching ${watches.length} thing${watches.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
      watches,
    };
  }

  if (/(cancel|delete|remove|stop|pause)/i.test(trimmed)) {
    const target = watches[0];
    if (!target) return { action: "cancel", message: "Nothing to cancel yet.", watches };
    await deleteWatch(target.id);
    return {
      action: "cancel",
      message: `Done — I stopped watching ${target.label ?? target.product_name ?? target.id}.`,
      watches: await getWatches(),
    };
  }

  if (/(check|scrape|update me|status|how.*(going|looking))/i.test(trimmed)) {
    const target = watches[0];
    if (!target) {
      return {
        action: "check",
        message: "I'm not watching anything yet — try \"Watch the iPhone 17 Pro and alert me when it drops below $949\".",
        watches,
      };
    }
    const run: RunResult = await runScrapePass(target.id);
    const suffix = run.alerted
      ? ` 🔔 Condition met — ${run.value}.`
      : run.value != null
        ? ` Currently ${target.field === "price" ? `$${run.value}` : run.value}.`
        : " I couldn't read a value — still watching.";
    return {
      action: "check",
      message: `Checked ${target.label ?? target.product_name ?? target.id}.${suffix}`,
      watch: run.watch,
      watches: await getWatches(),
      alert: run.alerted ? run.watch : undefined,
      events: run.events,
    };
  }

  // Primary path: watch creation. Deterministic first (instant, reliable for
  // the demo), NIM as the structured-JSON authority for novel phrasing.
  let parsed = parseIntentDeterministic(trimmed);
  if (!parsed) parsed = await parseIntentNim(trimmed);

  if (!parsed) {
    return {
      action: "unknown",
      message: "I watch pages and alert you on change. Try: \"Watch the iPhone 17 Pro and alert me when it drops below $949\".",
      watches,
    };
  }

  const field = parsed.field;
  const operator = parsed.condition;
  const target = field === "price" && parsed.target_price != null ? String(parsed.target_price) : null;

  const watch = await createWatchFromIntent({
    label: field === "stock" ? `${parsed.product_name} (${operator === "out_of_stock" ? "out of stock" : "in stock"})` : `${parsed.product_name} under $${target ?? "?"}`,
    url: STORE_URL,
    intent: `Find the ${field} for the ${parsed.product_name} on this page`,
    field,
    operator,
    target,
    query: parsed.product_name,
  });

  // First real scrape right now.
  const run = await runScrapePass(watch.id);

  const when =
    field === "stock"
      ? operator === "out_of_stock"
        ? "the moment it goes out of stock"
        : "the moment it's back in stock"
      : `the moment the price drops below $${target}`;

  // run.value already carries its natural form ("$139" or "In Stock").
  const current = run.value;

  let message = `Watching ${parsed.product_name}.`;
  if (current) message += ` Currently ${current}.`;
  message += ` I'll tell you ${when}.`;
  if (run.alerted) message += ` 🔔 Actually — condition already met: ${current}.`;

  return {
    action: "create",
    message,
    watch: run.watch,
    watches: await getWatches(),
    alert: run.alerted ? run.watch : undefined,
    events: run.events,
    parsed,
  };
}
