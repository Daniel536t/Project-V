// SENSE agent — the only place an LLM is used is intent extraction (structured
// JSON output). Everything else is templated responses driven by real API state.
// We use NVIDIA NIM (lib/llm-router.ts) for the LLM — not OpenRouter.

import { callLLM } from "./llm-router";
import { MODELS } from "./constants";
import { STORE_DOMAINS } from "./config";
import { createWatchFromIntent, runScrapePass, type RunResult } from "./sense";
import { deleteWatch, getWatches, type WatchRow } from "./db";
import { FEATURED_PRODUCTS, detectProductName, detectProductId, featuredById } from "./store-shared";
import { getProduct } from "./store";
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
  field: "price" | "stock" | "content";
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
  if (/(stock|restock|back in|available|inventory|out of stock|sold out|pre-?orders?|pre-?sales?)/i.test(m)) {
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
  } else {
    // No price, no stock language — it's a page-change watch ("tell me when
    // a new post appears"). The collector extracts the page headline; the
    // diff is on content, not a phantom price that doesn't exist.
    return { kind: "external", url, label: `${domain} · page change`, field: "content", operator: "changed", target: null };
  }

  return { kind: "external", url, label: `${domain} · ${operator === "changed" ? "any change" : operator + " $" + target}`, field: "price", operator, target };
}

// ---- Subjects that are clearly NOT one of the five demo-store products ----
// The default product is a demo feature: "alert me when it drops below $900"
// with no subject named still means the iPhone 17 Pro. But when the message
// explicitly names something else (Bitcoin, GTA 6, Steam, …), the store
// parser must NOT claim it — that silently creates a watch on the wrong
// thing. The guard below only fires when no store product was detected.

const NON_STORE_SUBJECTS =
  /(bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|dogecoin|\bdoge\b|\bxrp\b|ripple|cardano|\bada\b|\bcrypto\b|\bgta\b|\bps5\b|\bps6\b|\bswitch\s*2\b|nintendo|\bsteam\b|stockx|\bxbox\b)/i;

function mentionsNonStoreSubject(m: string): boolean {
  return NON_STORE_SUBJECTS.test(m);
}

// ---- Crypto price watch — no URL needed ("alert me when Bitcoin goes above $120000") ----
// Maps a coin to its real CoinMarketCap page and runs the SAME external
// collector pipeline: real Bright Data scrape, real envelope, real alert.

const CRYPTO_SLUGS: Array<{ re: RegExp; slug: string; name: string }> = [
  { re: /\bbitcoin\b|\bbtc\b/i, slug: "bitcoin", name: "Bitcoin" },
  { re: /\bethereum\b|\beth\b/i, slug: "ethereum", name: "Ethereum" },
  { re: /\bsolana\b|\bsol\b/i, slug: "solana", name: "Solana" },
  { re: /\bdogecoin\b|\bdoge\b/i, slug: "dogecoin", name: "Dogecoin" },
  { re: /\bxrp\b|\bripple\b/i, slug: "xrp", name: "XRP" },
  { re: /\bcardano\b|\bada\b/i, slug: "cardano", name: "Cardano" },
];

export function parseCryptoIntentDeterministic(msg: string): ExternalIntent | null {
  const m = msg.trim();
  if (/(https?:\/\/)/i.test(m)) return null; // an explicit URL → external parser owns it
  if (/\?/.test(m) || /(what|how much|current|right now|price of)/i.test(m)) return null; // questions → ask mode
  if (!/(watch|track|monitor|alert|notify|ping|tell me)/i.test(m)) return null;
  if (!/(price|above|below|over|under|drop|drops|rises?|falls?|hits?)/i.test(m)) return null;
  const coin = CRYPTO_SLUGS.find((c) => c.re.test(m));
  if (!coin) return null;
  const targetM = m.match(/(?:under|below|less than|over|above|more than)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)/i);
  let operator = "changed";
  let target: string | null = null;
  if (targetM) {
    target = targetM[1].replace(/,/g, "");
    operator = /(over|above|more than)/i.test(targetM[0]) ? ">" : "<";
  }
  return {
    kind: "external",
    url: `https://coinmarketcap.com/currencies/${coin.slug}/`,
    label: `${coin.name} · ${operator === "changed" ? "any change" : `${operator === "<" ? "<" : ">"} $${target}`}`,
    field: "price",
    operator,
    target,
  };
}

// ---- Release / preorder watch without a URL ("tell me when GTA 6 preorders open") ----
// Honest behavior: SENSE can watch a page the moment the user points it at
// one. Without a URL it asks for the page instead of pretending.

export interface ReleaseIntent {
  kind: "release";
  subject: string;
  url: string | null;
}

export function parseReleaseIntent(msg: string): ReleaseIntent | null {
  const m = msg.trim();
  if (!/(pre-?orders?|pre-?sales?|presales?|up for sale|goes on sale|becomes? available|open for (pre-?)?orders?|launch(es)?)/i.test(m)) return null;
  if (/\$\s*\d/.test(m)) return null; // explicit price → price-watch paths
  if (/(hacker\s*news|\bhn\b)/i.test(m)) return null; // live parser owns HN
  if (detectProductId(m)) return null; // store stock watch ("iPhone back in stock")
  if (/(https?:\/\/)/i.test(m)) return null; // external parser owns URL messages
  const urlM = m.match(/(https?:\/\/[^\s]+)/i);
  const subject = m
    .replace(/(https?:\/\/\S+)/gi, " ")
    .replace(/\b(keep an eye on|keep track of|hold a spot for|hold a spot|let me know when|the moment|as soon as|for me|watch|monitor|track|tell me|alert me|notify me|ping me|when|if)\b/gi, " ")
    .replace(/\b(pre-?orders?|pre-?sales?|presales?|goes up|go up|up for sale|goes on sale|opens?|open|becomes? available|available|launch(es)?|releases?|released|me|us)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 .+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+(and|or|for|to|on)$/i, "");
  if (!subject || subject.length < 2) return null;
  return { kind: "release", subject, url: urlM ? urlM[1].replace(/[.,;:!?)]+$/, "") : null };
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
  // Guard: NIM's HN extractor must never hallucinate a live watch from a
  // message that names some other subject ("tell me when GTA 6 presales
  // open" → topic:"GTA 6", rank:5 would create a nonsense HN watch).
  if (!/(hacker\s*news|news\.ycombinator|\bhn\b)/i.test(msg) && mentionsNonStoreSubject(msg)) return null;
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
    // Default product stays — unless the message names something that is
    // clearly NOT one of our products ("alert me when Bitcoin is available").
    if (!detectProductId(m) && mentionsNonStoreSubject(m)) return null;
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
  if (!detectProductId(m) && mentionsNonStoreSubject(m)) return null;
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
    // Trust the LLM only when it named one of OUR products. Vague phrasing
    // keeps the demo default — but a message naming something else (Bitcoin,
    // GTA 6, …) must never be hijacked into an iPhone watch.
    const llmName = (obj.product_name ?? "").toLowerCase();
    const matched = FEATURED_PRODUCTS.find((p) => p.name.toLowerCase() === llmName);
    if (matched) {
      return { product_name: matched.name, target_price: obj.target_price ?? null, condition, field };
    }
    if (mentionsNonStoreSubject(msg)) return null;
    return { product_name: DEFAULT_PRODUCT, target_price: obj.target_price ?? null, condition, field };
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

// ---- Ask mode: one-off fetch & answer — SENSE answers, nothing watched ----

/** A question about data, not a request to keep watching. */
export function isAsk(msg: string): boolean {
  // Watch-intent markers own the message — never steal them.
  if (/(watch|track|monitor|alert|notify|ping|let me know|when\b|below|above|under|over)/i.test(msg)) return false;
  if (/^\s*(list|show)\b/i.test(msg)) return false;
  return /(what|how much|how many|current|right now|price|stock|in stock|available|check|look up|tell me about|status)/i.test(msg) || /\?\s*$/.test(msg);
}

/** Pick the watch a message names — by product/label/URL overlap, not blind first-row. */
function pickWatch(watches: WatchRow[], msg: string): WatchRow | null {
  if (watches.length === 0) return null;
  const m = msg.toLowerCase();
  const tokens = m.split(/[^a-z0-9.]+/).filter((t) => t.length > 2);
  const scored = watches
    .map((w) => {
      const hay = `${w.product_name ?? ""} ${w.label ?? ""} ${w.url ?? ""}`.toLowerCase();
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += t.length;
      return { w, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].w : watches[0];
}

async function askByUrl(url: string, msg: string, nameHint?: string): Promise<AgentReply> {
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  const existing = (await getWatches()).find((w) => w.url === url);
  if (existing) {
    const isStorePage = existing.url === STORE_URL || existing.url.startsWith("/api/store");
    if (isStorePage) {
      // Store scrapes are local and instant — answer synchronously.
      const run = await runScrapePass(existing.id).catch(() => null);
      if (run?.value) {
        return {
          action: "ask",
          message: `Sir — fresh reading on ${run.watch.product_name ?? existing.label}: ${run.value}. Straight from the page, just now. Shall I set a proper watch on it?`,
          watch: run.watch,
          watches: await getWatches(),
        };
      }
    } else {
      // External collector runs take 20–90s — the reading arrives via SSE.
      void runScrapePass(existing.id);
      return {
        action: "ask",
        message: `Sir — checking ${domain} for you now. The collector takes a moment; the reading will arrive presently. Same collector as your watch (${existing.id}).`,
        watches: await getWatches(),
      };
    }
  }
  // No reader on this page yet — build one, honestly labeled as slow.
  const watch = await createWatchFromIntent({
    label: `ask · ${domain}`,
    url,
    intent: "Extract: page title and main heading; product name, current price and stock status if present",
    field: "price",
    operator: "changed",
    target: null,
    query: nameHint ?? domain,
    source: "external",
  });
  void runScrapePass(watch.id);
  return {
    action: "ask",
    message: `Sir — I don't have a reader on ${domain} yet. I'm briefing one now (60–90 seconds); the answer arrives the moment the first sweep lands. I'll keep the collector on hand so next time it's instant — say "cancel it" if you'd rather I didn't.`,
    watch,
    watches: await getWatches(),
  };
}

async function handleAsk(msg: string): Promise<AgentReply | null> {
  if (!isAsk(msg)) return null;
  const urlM = msg.match(/(https?:\/\/[^\s]+)/i);
  const productId = detectProductId(msg);

  // 1) Store product question — instant answer from real store state.
  if (productId && !urlM) {
    const wanted = featuredById(productId)?.name ?? productId;
    const product = await getProduct().catch(() => null);
    if (product && product.name.toLowerCase() === wanted.toLowerCase()) {
      return {
        action: "ask",
        message: `Sir — ${product.name} sits at $${product.price}, ${product.in_stock ? "in stock" : "currently unavailable"}. That reading is live from the store itself. Shall I set a watch on it?`,
        watches: await getWatches(),
      };
    }
    return {
      action: "ask",
      message: product
        ? `Sir, the shelf currently holds ${product.name} at $${product.price} — ${wanted} isn't on it at the moment. Say "watch ${wanted}" and I'll take it from there, or point me at any page.`
        : `Sir — I couldn't reach the store just now. One moment, and ask again?`,
      watches: await getWatches(),
    };
  }

  // 2) Crypto price question — through the same CoinMarketCap pipeline.
  if (!urlM) {
    const coin = CRYPTO_SLUGS.find((c) => c.re.test(msg));
    if (coin) {
      return askByUrl(`https://coinmarketcap.com/currencies/${coin.slug}/`, msg, coin.name);
    }
    return null; // not an ask SENSE can serve — let watch parsing try
  }

  // 3) URL question — reuse the collector, or build one.
  return askByUrl(urlM[1].replace(/[.,;:!?)]+$/, ""), msg);
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
    const target = pickWatch(watches, trimmed);
    if (!target) return { action: "cancel", message: "Nothing to cancel yet, Sir.", watches };
    await deleteWatch(target.id);
    return {
      action: "cancel",
      message: `Sir — I've stopped watching ${target.label ?? target.product_name ?? target.id}. The collector stays on the books should you want it again.`,
      watches: await getWatches(),
    };
  }

  if (/(check|scrape|update me|status|how.*(going|looking))/i.test(trimmed)) {
    const target = pickWatch(watches, trimmed);
    if (target) {
      const run: RunResult = await runScrapePass(target.id);
      const suffix = run.conditionMet
        ? ` 🔔 Condition met — ${run.value}.`
        : run.value != null
          ? ` Currently ${target.field === "price" ? `$${run.value}` : run.value}.`
          : " I couldn't read a value — still watching.";
      return {
        action: "check",
        message: `Sir — I checked ${target.label ?? target.product_name ?? target.id}.${suffix}`,
        watch: run.watch,
        watches: await getWatches(),
        alert: run.alerted ? run.watch : undefined,
        events: run.events,
      };
    }
    // No watch and no URL → gentle refusal; a URL falls through to ask mode.
    if (!/(https?:\/\/)/i.test(trimmed)) {
      return {
        action: "check",
        message: "I'm not watching anything yet — try \"Watch the iPhone 17 Pro and alert me when it drops below $949\".",
        watches,
      };
    }
  }

  // One-off question — SENSE answers, no watch created.
  const ask = await handleAsk(trimmed);
  if (ask) return ask;

  // LIVE semantic watch (Hacker News → "top N") — a real Bright Data collector.
  // Deterministic first; the NIM fallback waits until every cheap parser below
  // has had its turn (otherwise "GTA 6 presale" pays a 25s LLM round-trip).
  const liveDet = parseLiveIntentDeterministic(trimmed);
  if (liveDet) {
    const live = liveDet;
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
      intent: extParsed.field === "content"
        ? "Extract: the page's main title and the latest post or item heading"
        : `Extract: product name, ${extParsed.field === "stock" ? "stock status" : "price as a number"}`,
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

  // Crypto price watch — real CoinMarketCap page through the SAME external
  // collector pipeline (real Bright Data scrape, real envelope, real alert).
  const crypto = parseCryptoIntentDeterministic(trimmed);
  if (crypto) {
    const watch = await createWatchFromIntent({
      label: crypto.label,
      url: crypto.url,
      intent: `Extract: coin name, current price as a number`,
      field: crypto.field,
      operator: crypto.operator,
      target: crypto.target,
      query: crypto.label,
      source: "external",
    });
    void runScrapePass(watch.id);
    return {
      action: "create",
      message: `Watching ${crypto.label} on coinmarketcap.com. Building the collector now (60–90s) — I'll ping you ${crypto.target ? `when the price ${crypto.operator === "<" ? "drops below" : "rises above"} $${crypto.target}` : "on any price change"}.`,
      watch,
      watches: await getWatches(),
      events: [],
    };
  }

  // Release / preorder intent without a URL — ask for the page. Honest, and
  // it keeps the "watch anything" promise without faking data.
  const release = parseReleaseIntent(trimmed);
  if (release) {
    return {
      action: "need_url",
      message: `I can watch ${release.subject} for you — I just need the page. Paste the product page where preorders will appear, like: "Watch https://store.steampowered.com/app/... and ping me when preorders open". The moment that page flips to available, you get pinged.`,
      watches,
    };
  }

  // Live NIM fallback — novel HN phrasing only (guarded against non-HN subjects).
  const live = await parseLiveIntentNim(trimmed);
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
      : operator === ">" || operator === ">="
        ? `the moment the price goes above $${target}`
        : `the moment the price drops below $${target}`;

  // run.value already carries its natural form ("$139" or "In Stock").
  const current = run.value;

  let message = `Watching ${parsed.product_name}.`;
  if (current) message += ` Currently ${current}.`;
  message += ` I'll tell you ${when}.`;
  if (run.alerted) message += ` 🔔 Actually — condition already met: ${current}.`;
  if (/\b(buy|purchase)\b/i.test(trimmed)) message += ` I can't place the order for you — but the second it hits your price, you'll get the ping with everything you need.`;

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
