import { MODELS } from "./constants";
import { callLLM } from "./llm-router";
import { createWatchFromIntent, runScrapePass } from "./sense";
import { deleteWatch, getWatches, type WatchRow } from "./db";

const DEMO_URL = "/demo/target";

type Action =
  | {
      type: "create";
      label: string;
      url: string;
      intent: string;
      field: string;
      operator: string;
      target: string | null;
    }
  | { type: "list" }
  | { type: "check"; label: string | null }
  | { type: "cancel"; label: string | null }
  | { type: "explain"; label: string | null }
  | { type: "find"; query: string };

function fieldFor(msg: string): "price" | "stock" {
  return /(stock|available|availability|restock|back in|out of)/i.test(msg)
    ? "stock"
    : "price";
}

function numericTarget(msg: string): string | null {
  // Prefer an explicit comparator: "under $800", "below 800", "drops to 799".
  const after = msg.match(
    /(?:under|below|over|above|less than|more than|drops?\s+to|hits?|at)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  );
  if (after) return after[1];
  // Otherwise a dollar amount anywhere (avoids matching "PS5" / "A7IV").
  const dollar = msg.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (dollar) return dollar[1];
  return null;
}

function operatorFor(msg: string, field: string): string {
  if (field === "stock") {
    return /(out of|sold out|gone)/i.test(msg) ? "out_of_stock" : "in_stock";
  }
  if (/(under|below|less than|cheaper|drops? (to|below)|hit)/i.test(msg)) return "<";
  if (/(over|above|more than|at least)/i.test(msg)) return ">";
  if (/(exactly|==)/i.test(msg)) return "==";
  return "<";
}

function labelFor(msg: string, field: string, target: string | null): string {
  const product = /ps5|playstation/i.test(msg)
    ? "PS5"
    : /a7|sony|camera/i.test(msg)
      ? "Sony A7IV"
      : /vinyl|album|record/i.test(msg)
        ? "vinyl drop"
        : /apartment|flat/i.test(msg)
          ? "apartment"
          : /visa|appointment/i.test(msg)
            ? "visa slot"
            : "watch";
  if (field === "stock") return `${product} in stock`;
  if (target) return `${product} under $${target}`;
  return product;
}

/** Clean subject for image search, e.g. "watch the PS5 under $800" → "PlayStation 5". */
function subjectFor(msg: string): string {
  if (/ps5|playstation/i.test(msg)) return "PlayStation 5";
  if (/a7|sony|camera/i.test(msg)) return "Sony A7IV";
  if (/vinyl|record|album/i.test(msg)) return "vinyl record";
  if (/apartment|flat/i.test(msg)) return "apartment";
  if (/visa|appointment/i.test(msg)) return "visa appointment";
  return msg
    .replace(
      /watch|track|monitor|tell me|let me know|alert me|notify me|ping me|the moment|it drops|drops|in stock|back in|restock|available|under\s*\$?\d+(?:\.\d+)?|\$\d+(?:\.\d+)?|when|if/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseAction(msg: string): Action {
  const m = msg.trim();

  if (/(cancel|delete|remove|stop|pause)/i.test(m)) {
    return { type: "cancel", label: findLabel(m) };
  }
  if (/(what|list|show).*(watching|watches|tracking|monitors)/i.test(m) || /^list$/i.test(m)) {
    return { type: "list" };
  }
  if (/(how did you find|how do you know|explain|which selector|where.*(price|data))/i.test(m)) {
    return { type: "explain", label: findLabel(m) };
  }
  if (/(check|scrape|update me|how.*(going|looking)|any (news|update)|status)/i.test(m)) {
    return { type: "check", label: findLabel(m) };
  }

  const wantsWatch = /(watch|track|monitor|let me know|tell me when|alert me|notify|ping me)/i.test(m);
  if (wantsWatch || /\$\d+|under|below|in stock|restock|available/i.test(m)) {
    const field = fieldFor(m);
    const target = field === "price" ? numericTarget(m) : null;
    const operator = operatorFor(m, field);
    return {
      type: "create",
      label: labelFor(m, field, target),
      url: DEMO_URL,
      intent: m,
      field,
      operator,
      target,
    };
  }

  return { type: "find", query: m };
}

function findLabel(msg: string): string | null {
  for (const kw of ["ps5", "playstation", "a7", "camera", "vinyl", "album", "record", "apartment", "visa"]) {
    if (new RegExp(kw, "i").test(msg)) return kw;
  }
  return null;
}

function matchWatch(watches: WatchRow[], label: string | null): WatchRow | null {
  if (!label) return watches.length === 1 ? watches[0] : null;
  const l = label.toLowerCase();
  return (
    watches.find((w) => (w.label ?? "").toLowerCase().includes(l)) ??
    watches.find((w) => w.id.toLowerCase().includes(l)) ??
    null
  );
}

interface LLMParsedWatch {
  url?: string;
  label?: string;
  intent?: string;
  field?: string;
  operator?: string;
  target?: string | null;
}

async function llmParseWatch(msg: string): Promise<Action | null> {
  try {
    const sys =
      'You extract a watch request from a user message into JSON with exactly these keys: ' +
      '{"url": string, "label": string, "intent": string, "field": "price"|"stock", ' +
      '"operator": "<"|"<="|">"|">="|"=="|"in_stock"|"out_of_stock", "target": string|null}. ' +
      'url defaults to "/demo/target". target is a number as a string (e.g. "800"), or null for stock. ' +
      "Respond with ONLY the JSON object, no prose, no markdown fences.";
    const raw = await callLLM(MODELS.conversational, msg, {
      system: sys,
      maxTokens: 300,
      temperature: 0,
    });
    const json = raw.replace(/```(?:json)?/gi, "").trim();
    const obj = JSON.parse(json) as LLMParsedWatch;
    if (!obj.field) return null;
    return {
      type: "create",
      label: obj.label ?? "watch",
      url: obj.url ?? DEMO_URL,
      intent: obj.intent ?? msg,
      field: obj.field === "stock" ? "stock" : "price",
      operator: obj.operator ?? "<",
      target: obj.target ?? null,
    };
  } catch {
    return null;
  }
}

export interface AgentReply {
  action: string;
  message: string;
  query?: string;
  watches?: WatchRow[];
  watch?: WatchRow;
  alert?: WatchRow;
  events?: string[];
}

export async function handleAgentMessage(msg: string): Promise<AgentReply> {
  let action = parseAction(msg);

  if (
    action.type === "find" &&
    /(watch|track|monitor|tell me when|alert me|notify|under|in stock|restock|\$\d+)/i.test(msg)
  ) {
    const parsed = await llmParseWatch(msg);
    if (parsed) action = parsed;
  }

  switch (action.type) {
    case "create": {
      const watch = await createWatchFromIntent(action);
      const when =
        action.field === "stock"
          ? "the moment it comes back in stock"
          : action.target
            ? `the moment the price drops below $${action.target}`
            : "whenever the price changes";
      return {
        action: "create",
        message: `Done. Watch ${watch.id} is live. I'm tracking "${watch.label}" and I'll tell you ${when}.`,
        query: subjectFor(msg),
        watch,
        watches: await getWatches(),
      };
    }

    case "list": {
      const watches = await getWatches();
      if (watches.length === 0) {
        return {
          action: "list",
          message: "You're not watching anything yet. Tell me what to keep an eye on.",
          watches,
        };
      }
      const lines = watches.map((w) => `• ${w.id} — ${w.label ?? w.url} (${w.status})`);
      return {
        action: "list",
        message: `You're watching ${watches.length} thing${watches.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
        watches,
      };
    }

    case "check": {
      const watches = await getWatches();
      const target = action.label ? matchWatch(watches, action.label) : watches[0];
      if (!target) {
        return {
          action: "check",
          message: 'I don\'t have a watch by that name yet — try "watch the PS5 under $800" first.',
          watches,
        };
      }
      const run = await runScrapePass(target.id);
      const tail = run.alerted
        ? ` 🎯 Condition met: ${run.value}. Alert raised.`
        : run.healed
          ? ` It had broken and just healed itself — same watch, scar #${run.watch.scar_count}.`
          : run.value == null
            ? ` Still broken — bot wall is up.`
            : ` Still at $${run.value}.`;
      return {
        action: "check",
        message: `Checked ${run.watch.label ?? run.watch.id}.${tail}`,
        watch: run.watch,
        watches: await getWatches(),
        events: run.events,
        alert: run.alerted ? run.watch : undefined,
      };
    }

    case "cancel": {
      const watches = await getWatches();
      const target = action.label ? matchWatch(watches, action.label) : watches[0];
      if (!target) {
        return { action: "cancel", message: "Nothing by that name to cancel.", watches };
      }
      await deleteWatch(target.id);
      return {
        action: "cancel",
        message: `Done. I stopped watching ${target.label ?? target.id}.`,
        watches: await getWatches(),
      };
    }

    case "explain": {
      const watches = await getWatches();
      const target = action.label ? matchWatch(watches, action.label) : watches[0];
      if (!target) {
        return { action: "explain", message: "No watch to explain yet.", watches };
      }
      const scars = target.scar_count ?? 0;
      return {
        action: "explain",
        message: `For ${target.label ?? target.id}: I extract "${target.field}" with the selector "${target.selector ?? "(none)"}". It's healed ${scars} time${scars === 1 ? "" : "s"}. The scar log shows every break and repair — an immune-system log, not a museum.`,
        watch: target,
        watches,
      };
    }

    case "find": {
      return {
        action: "find",
        message: `Here's what I found on “${action.query}”.`,
        query: action.query,
        watches: await getWatches(),
      };
    }
  }
}
