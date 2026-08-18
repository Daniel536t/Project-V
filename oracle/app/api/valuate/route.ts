import { NextResponse } from "next/server";
import { MODELS } from "@/lib/constants";
import { llmRouter } from "@/lib/llm-router";

export const runtime = "nodejs";

interface ValuateBody {
  image?: string; // base64 data URL
  name?: string;
}

export async function POST(request: Request) {
  let body: ValuateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  // TODO(batch 3): wire in nemotron-ocr-v2 for text extraction and
  // muse-glimmer-30b for vision. For now we route through the primary
  // multimodal model using a text description of the upload.
  const prompt =
    `Analyze this uploaded product photo (${body.name ?? "unnamed"}). ` +
    `Identify the item, assess its condition, and estimate scarcity/valuation. ` +
    `Image data: ${body.image.slice(0, 200)}… (truncated)`;

  try {
    const answer = await llmRouter.callLLM(
      MODELS.primary,
      prompt,
      { system: "You are ORACLE's valuation engine. Be honest about uncertainty." },
    );
    return NextResponse.json({ valuation: answer, model: MODELS.primary });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Vision models are not configured yet. Add NVIDIA_API_KEY or OPENROUTER_API_KEY to .env.local.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
