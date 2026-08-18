import { MODELS } from "./constants";

const NIM_BASE = "https://integrate.api.nvidia.com/v1";

export type QueryIntent = "price" | "valuation" | "timeline" | "chat";

export interface LLMResponse {
  answer: string;
  data?: unknown;
  visualizations?: unknown[];
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface NimMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatPart[];
}

/** Both NVIDIA keys (two accounts → fallback on rate limit / auth). */
function nimKeys(): string[] {
  return [process.env.NVIDIA_API_KEY, process.env.NVIDIA_API_KEY_2].filter(
    (k): k is string => Boolean(k),
  );
}

/** Statuses worth retrying with the backup key. */
function isRetryable(status: number): boolean {
  return [429, 401, 403, 500, 502, 503].includes(status);
}

/**
 * Low-level NVIDIA NIM chat-completions call.
 * Handles the two-key fallback and the fact that reasoning models
 * (inkling, muse-glimmer) put their chain-of-thought in `reasoning_content`
 * and the final answer in `content`.
 */
async function callNim(
  model: string,
  messages: NimMessage[],
  opts: LLMOptions = {},
): Promise<string> {
  const keys = nimKeys();
  if (keys.length === 0) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  let lastError: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const res = await fetch(`${NIM_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.4,
          top_p: 0.95,
          stream: false,
        }),
      });

      if (isRetryable(res.status) && i < keys.length - 1) {
        lastError = new Error(
          `NIM ${res.status} for ${model} on key #${i + 1}: ${(await res.text()).slice(0, 200)}`,
        );
        continue; // fall back to the next key
      }

      if (!res.ok) {
        throw new Error(
          `NIM ${res.status} for ${model}: ${(await res.text()).slice(0, 300)}`,
        );
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const text = (msg?.content || msg?.reasoning_content || "").trim();
      if (!text) throw new Error(`NIM returned empty content for ${model}`);
      return text;
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError ?? new Error(`All NVIDIA keys failed for ${model}`);
}

/** Heuristic: short factual queries are simple, analysis/prediction is complex. */
function assessComplexity(query: string): "simple" | "complex" {
  const complexKeywords = [
    "why",
    "how",
    "explain",
    "compare",
    "analyze",
    "predict",
    "trend",
    "should i",
    "worth",
  ];
  return complexKeywords.some((kw) => query.toLowerCase().includes(kw))
    ? "complex"
    : "simple";
}

/** Fast conversational answers for simple text-only queries. */
async function callNemotronLightning(
  prompt: string,
  context?: Record<string, unknown>,
): Promise<LLMResponse> {
  const answer = await callNim(
    MODELS.conversational,
    [
      {
        role: "system",
        content:
          "You are ORACLE, a Spider-Verse-themed web intelligence assistant. Answer concisely and with confidence.",
      },
      {
        role: "user",
        content: context ? `${prompt}\n\nContext: ${JSON.stringify(context)}` : prompt,
      },
    ],
    { maxTokens: 1024, temperature: 0.4 },
  );
  return { answer };
}

/** Deep reasoning for complex text-only queries. */
async function callInkling(prompt: string, context?: Record<string, unknown>): Promise<LLMResponse> {
  const answer = await callNim(
    MODELS.primary,
    [
      {
        role: "system",
        content:
          "You are ORACLE, a web intelligence assistant with 25 years of scraped web data. Reason carefully and cite the era/year when relevant.",
      },
      {
        role: "user",
        content: context ? `${prompt}\n\nContext: ${JSON.stringify(context)}` : prompt,
      },
    ],
    { maxTokens: 4096, temperature: 0.5 },
  );
  return { answer };
}

/** OCR: extract all text from an image. */
async function callNemotronOCR(imageUrl: string): Promise<string> {
  const keys = nimKeys();
  if (keys.length === 0) throw new Error("NVIDIA_API_KEY is not set");

  let lastError: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetch(`${NIM_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys[i]}`,
        },
        body: JSON.stringify({
          model: MODELS.ocr,
          // nemotron-parse accepts image-only input (no text prompt).
          messages: [
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: imageUrl } }],
            },
          ],
          max_tokens: 2048,
          temperature: 0,
        }),
      });

      if (isRetryable(res.status) && i < keys.length - 1) {
        lastError = new Error(`NIM ${res.status} OCR: ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`NIM ${res.status} OCR: ${(await res.text()).slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      };

      const msg = data.choices?.[0]?.message;
      if (msg?.content) return msg.content;

      // nemotron-parse returns extracted text via a `markdown_bbox` tool call.
      const args = msg?.tool_calls?.[0]?.function?.arguments;
      if (args) {
        const parsed = JSON.parse(args) as Array<{ text?: string }>;
        return parsed.map((p) => p.text ?? "").filter(Boolean).join("\n");
      }

      throw new Error(`OCR returned no text for ${MODELS.ocr}`);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError ?? new Error(`OCR failed for ${MODELS.ocr}`);
}

/** Vision analysis with Muse Glimmer (returns structured JSON). */
async function callMuseGlimmer(imageUrl: string, ocrText: string): Promise<Record<string, unknown>> {
  const raw = await callNim(
    MODELS.vision,
    [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          {
            type: "text",
            text: `Analyze this product image. Extracted text: "${ocrText}".\nIdentify:\n1. Product name and model\n2. Condition (New, Like New, Good, Fair, Poor)\n3. Completeness (with box, with accessories, item only)\n4. Any notable features or damage\nReturn as JSON.`,
          },
        ],
      },
    ],
    { maxTokens: 2048, temperature: 0.3 },
  );

  // Models often wrap JSON in markdown fences — strip them before parsing.
  const json = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { raw: json };
  }
}

/** Multimodal flow: OCR → vision analysis → deep reasoning. */
async function handleMultimodalQuery(
  question: string,
  imageUrl: string,
  context?: Record<string, unknown>,
): Promise<LLMResponse> {
  const ocrText = await callNemotronOCR(imageUrl);
  const visualAnalysis = await callMuseGlimmer(imageUrl, ocrText);
  return callInkling(question, { ...(context ?? {}), ocrText, visualAnalysis });
}

/** Route a query to the right model based on complexity and image presence. */
export async function routeQuery(
  input: string,
  imageUrl?: string,
  context?: Record<string, unknown>,
): Promise<LLMResponse> {
  if (imageUrl) {
    return handleMultimodalQuery(input, imageUrl, context);
  }

  const complexity = assessComplexity(input);
  if (complexity === "simple") {
    return callNemotronLightning(input, context);
  }
  return callInkling(input, context);
}

/* ------------------------------------------------------------------ *
 * Backward-compatible exports (used by the existing API routes).
 * ------------------------------------------------------------------ */

/** Classify a user query and pick the model best suited for it. */
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

/** Call a model by slug with a plain prompt (legacy API route helper). */
export async function callLLM(
  model: string,
  prompt: string,
  opts: LLMOptions = {},
): Promise<string> {
  const messages: NimMessage[] = [
    ...(opts.system
      ? [{ role: "system" as const, content: opts.system }]
      : []),
    { role: "user", content: prompt },
  ];
  return callNim(model, messages, opts);
}

export const llmRouter = { routeQuery, routeIntent, callLLM };
