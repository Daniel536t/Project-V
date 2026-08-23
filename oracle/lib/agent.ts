// SENSE agent — the only place an LLM is used is intent extraction (structured
// JSON output). Everything else is templated responses driven by real API state.
// We use NVIDIA NIM (lib/llm-router.ts) for the LLM — not OpenRouter.

import { callLLM } from "./llm-router";
import { MODELS } from "./constants";
import { STORE_DOMAINS } from "./config";
import { createWatchFromIntent, runScrapePass, type RunResult } from "./sense";
import { deleteWatch, getWatches, type WatchRow } from "./db";
import { FEATURED_PRODUCTS, detectProductName } from "./store-shared";
import { HN_NAME, HN_URL } from "./live";

const STORE_URL = "/api/store/html";
const DEFAULT_PRODUCT = "iPhone 17 Pro";

export interface ParsedIntent {
  product_name: string;
  target_price: number | null;
  condition: string; // "<", "<=", ">", ">=", "==", "in_stock", "out_of_stock"
  field: "price" | "stock";
}

// ---- External watch (arbitrary URL) ----

export interface ExternalIntent {
  kind: "external";
  url: string;
  label: string;
  field: "price" | "stock";
  operator: string;
  target: string | null;
}

/** Deterministic parser: "watch <url>" + optional price/stock conditions. */
export function parseExternalIntentDeterministic(msg: string): ExternalIntent | null {
  const m = msg.trim();
  // Find a URL in the message
  const urlM = m.match(/(https?:\/\/[^\s]+)/i);
  if (!urlM) return null;
  const url = urlM[1].replace(/[.,;:!?)]+$/, "");

  // If the URL is our own store (Vercel or pm2 box), don't treat it as
  // external. The store needs a pinned collector that knows the product DOM —
  // a fresh Bright Data collector against a React SPA would always fail.
  // Let the store parser handle it instead.
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  if (STORE_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return null;

  const hasWatch = /(watch|track|monitor|scrape|keep an eye on|alert|notify|ping|tell me)/i.test(m);
  if (!hasWatch) return null;

  // Stock intent?
  if (/(stock|restock|back in|available|inventory|out of stock|sold out)/i.test(m)) {
    const operator = /(out of|sold out|gone|unavailable)/i.test(m) ? "out_of_stock" : "in_stock";
    return { kind: "external", url, label: `${domain} · stock`, field: "stock", operator, target: null };
  }

  // Price intent — handle $2,500, $1,299.99, etc.
  const targetM = m.match(/(?:under|below|less than|over|above|more than|drops?\s+to|hits?|at|==)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)/i);
  let operator = "changed"; // default: any change
  let target: string | null = null;
  if (targetM) {
    target = targetM[1].replace(/,/g, "");
    if (/(over|above|more than)/i.test(targetM[0])) operator = ">";
    else if (/==|exactly/i.test(targetM[0])) operator = "==";
    else operator = "<";
  }

  return { kind: "external", url, label: `${domain} · ${operator === "changed" ? "any change" : operator + " $" + target}`, field: "price", operator, target };
}

// ---- LIVE semantic watch ("watch HN and alert me when X hits the top N") ----

export interface LiveIntent {
  kind: "live";
  site: string;
  name: string;
  url: string;
  topic: string;
  rank: number;
}

const LIVE_SITES: Record<string, { name: string; url: string }> = {
  "hacker-news": { name: HN_NAME, url: HN_URL },
};

export function parseLiveIntentDeterministic(msg: string): LiveIntent | null {
  const m = msg.trim();
  if (!/(hacker\s*news|news\.ycombinator|\bhn\b)/i.test(m)) return null;
  const top = m.match(/top\s*(\d+)/i);
  if (!top) return null;
  const rank = Number(top[1]);

  // topic: the noun phrase before "story/stories/post/article/thread".
  const topicM = m.match(
    /(?:an?|any|for|about|on)\s+([^.]*?)\s+(?:story|stories|post|article|thread|hit)/i,
  );
  let topic = topicM ? topicM[1].trim() : "";
  topic = topic
    .replace(/hits?\s+the\s+top\s*\d+.*$/i, "")
    .replace(/[.\-–—]/g, " ")
    .trim();
  if (!topic) topic = "AI";

  return { kind: "live", site: "hacker-news", name: HN_NAME, url: HN_URL, topic, rank };
}

export async function parseLiveIntentNim(msg: string): Promise<LiveIntent | null> {
  try {
    const raw = await callLLM(MODELS.conversational, msg, {
      system:
        'Extract a live watch request into JSON with exactly these keys: {"site":"hacker-news","topic":string,"rank":number}. topic is the subject the user wants alerted about (e.g. "AI agents", "climate", "crypto"). rank is the top-N threshold (default 5). Respond with ONLY the JSON.',
      maxTokens: 200,
      temperature: 0,
    });
    const json = raw.replace(/```(?:json)?/gi, "").trim();
    const s = json.indexOf("{");
    const e = json.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    const obj = JSON.parse(json.slice(s, e + 1)) as { site?: string; topic?: string; rank?: number };
    const conf = LIVE_SITES[String(obj.site ?? "hacker-news")] ?? LIVE_SITES["hacker-news"];
    return {
      kind: "live",
      site: "hacker-news",
      name: conf.name,
      url: conf.url,
      topic: String(obj.topic ?? "AI"),
      rank: Number(obj.rank ?? 5),
    };
  } catch {
    return null;
  }
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
    return { product_name: detectProductName(m), target_price: null, condition, field };
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
  return { product_name: detectProductName(m), target_price: target, condition, field };
}

// ---- NIM structured-JSON parser ----

function nimSystemPrompt(): string {
  return (
    "Extract a watch request from the user message into JSON with exactly these keys:\n" +
    '{"product_name": string, "target_price": number|null, "condition": string, "field": "price"|"stock"}\n' +
    `- product_name: the product being watched, one of: ${FEATURED_PRODUCTS.map((p) => p.name).join(", ")}.\n` +
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
      product_name: obj.product_name ?? DEFAULT_PRODUCT,
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
    const suffix = run.conditionMet
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

  // LIVE semantic watch (Hacker News → "top N") — a real Bright Data collector.
  const live = parseLiveIntentDeterministic(trimmed) ?? (await parseLiveIntentNim(trimmed));
  if (live) {
    const watch = await createWatchFromIntent({
      label: `${live.name} — ${live.topic} in top ${live.rank}`,
      url: live.url,
      intent: `Extract the top stories from the front page (title, url, points, comments) and find stories about ${live.topic}`,
      field: "rank",
      operator: "<=",
      target: String(live.rank),
      query: live.topic,
      source: "live",
    });
    // First real scrape runs async (Bright Data batch job, ~2–3 min).
    void runScrapePass(watch.id);
    return {
      action: "create",
      message: `Watching ${live.name}. I'll ping you the moment a ${live.topic} story breaks into the top ${live.rank}. Collector ${watch.collector_id}.`,
      watch,
      watches: await getWatches(),
      events: [],
    };
  }

  // External watch — arbitrary URL the user provides ("watch amazon.com/...")
  const extParsed = parseExternalIntentDeterministic(trimmed);
  if (extParsed) {
    const watch = await createWatchFromIntent({
      label: extParsed.label,
      url: extParsed.url,
      intent: `Extract: product name, ${extParsed.field === "stock" ? "stock status" : "price as a number"}`,
      field: extParsed.field,
      operator: extParsed.operator,
      target: extParsed.target,
      query: extParsed.label,
      source: "external",
    });
    void runScrapePass(watch.id);
    const domain = (() => { try { return new URL(extParsed.url).hostname.replace(/^www\./, ""); } catch { return extParsed.url; } })();
    return {
      action: "create",
      message: `Watching ${domain}. I created a fresh collector (${watch.collector_id}) and I'm scraping it now. I'll ping you ${extParsed.field === "stock" ? "when stock changes" : extParsed.target ? `when the price ${extParsed.operator === "<" ? "drops below" : extParsed.operator === ">" ? "rises above" : "changes from"} $${extParsed.target}` : "when the price changes"}.`,
      watch,
      watches: await getWatches(),
      events: [],
    };
  }

  // Primary path: watch creation. Deterministic first (instant, reliable for
  // the demo), NIM as the structured-JSON authority for novel phrasing.
  let parsed = parseIntentDeterministic(trimmed);
  if (!parsed) parsed = await parseIntentNim(trimmed);

  if (!parsed) {
    return {
      action: "unknown",
      message: "I watch pages and alert you on change. Try: \"Watch the iPhone 17 Pro and alert me when it drops below $949\" or paste any URL like \"Watch https://amazon.com/dp/B0D1XD1ZV3.\"",
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
