import { MODELS } from "./constants";

export type QueryIntent = "price" | "valuation" | "timeline" | "chat";

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

/**
 * Classify a user query and pick the model best suited for it.
 * - price/valuation/timeline → heavy multimodal reasoning (inkling)
 * - chat → fast conversational model (nemotron lightning)
 */
export function routeIntent(input: string): {
  intent: QueryIntent;
  model: string;
} {
  const text = input.toLowerCase();

  if (/(rare|rarity|worth|value|valuable|authentic|condition|photo|image|this real)/.test(text)) {
    return { intent: "valuation", model: MODELS.primary };
  }
  if (/(buy|wait|price|cheap|expensive|cost|deal|worth it|drop|sale)/.test(text)) {
    return { intent: "price", model: MODELS.primary };
  }
  if (/(when|timeline|history|changed|comeback|trend|era|year)/.test(text)) {
    return { intent: "timeline", model: MODELS.primary };
  }
  return { intent: "chat", model: MODELS.conversational };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function nvidiaModelId(slug: string): string {
  // OpenRouter slugs -> NVIDIA NIM API model ids
  return slug.startsWith("nvidia/") ? slug.slice("nvidia/".length) : slug;
}

async function callNvidiaNim(
  model: string,
  messages: ChatMessage[],
  opts: LLMOptions,
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: nvidiaModelId(model),
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`NVIDIA NIM error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  opts: LLMOptions,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Call an LLM. NVIDIA models go through NVIDIA NIM; everything else falls
 * back to OpenRouter.
 */
export async function callLLM(
  model: string,
  prompt: string,
  opts: LLMOptions = {},
): Promise<string> {
  const messages: ChatMessage[] = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user", content: prompt },
  ];

  if (model.startsWith("nvidia/") && process.env.NVIDIA_API_KEY) {
    return callNvidiaNim(model, messages, opts);
  }
  return callOpenRouter(model, messages, opts);
}

export const llmRouter = { routeIntent, callLLM };
