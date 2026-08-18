import { NextResponse } from "next/server";
import { routeQuery } from "@/lib/llm-router";
import { queryDatabase } from "@/lib/db";

export const runtime = "nodejs";

const DEFAULT_QUESTION = "What is this and what is it worth?";

export async function POST(request: Request) {
  let imageDataUrl: string | null = null;
  let question = DEFAULT_QUESTION;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // Spec path: image + optional question as multipart form data.
    const formData = await request.formData();
    const image = formData.get("image");

    if (image instanceof File) {
      imageDataUrl = await fileToDataUrl(image);
    } else if (typeof image === "string" && image) {
      imageDataUrl = image;
    }

    const q = formData.get("question");
    if (typeof q === "string" && q.trim()) question = q.trim();
  } else {
    // Backward-compatible path: JSON with a base64 data URL
    // (the existing <ImageUpload /> component posts this shape).
    try {
      const body = (await request.json()) as {
        image?: string;
        question?: string;
      };
      imageDataUrl = typeof body.image === "string" ? body.image : null;
      if (typeof body.question === "string" && body.question.trim()) {
        question = body.question.trim();
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
  }

  if (!imageDataUrl) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  try {
    // Multimodal flow: OCR -> vision analysis -> deep reasoning.
    const analysis = await routeQuery(question, imageDataUrl);

    const visualAnalysis = (
      analysis.data as Record<string, unknown> | undefined
    )?.visualAnalysis;
    const productName = extractProductName(visualAnalysis);

    // Best-effort historical price lookup — DB may not be wired up yet.
    let priceHistory: unknown[] = [];
    try {
      priceHistory = await queryDatabase(
        `SELECT era, price, availability
         FROM scraped_data
         WHERE title ILIKE $1
         ORDER BY era ASC`,
        [`%${productName}%`],
      );
    } catch (err) {
      console.warn(
        "Valuation: price history unavailable (DB not configured):",
        err instanceof Error ? err.message : err,
      );
    }

    const recentPrices = priceHistory
      .map((row) => Number((row as { price?: unknown }).price))
      .filter((p) => Number.isFinite(p) && p > 0);

    const valuation =
      recentPrices.length > 0 ? buildPriceRange(recentPrices) : null;

    return NextResponse.json({
      analysis: analysis.answer,
      productName,
      priceHistory,
      valuation,
      visualAnalysis,
    });
  } catch (err) {
    console.error("Valuation API error:", err);
    return NextResponse.json(
      {
        error: "Failed to process image",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Extract a product name from Muse Glimmer's (loosely shaped) JSON output. */
function extractProductName(visualAnalysis: unknown): string {
  if (!visualAnalysis || typeof visualAnalysis !== "object") {
    return "Unknown Product";
  }
  const v = visualAnalysis as Record<string, unknown>;
  const candidate =
    v.product_name_and_model ??
    v.product_name ??
    v.productName ??
    v.name ??
    v.title ??
    v["1"];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : "Unknown Product";
}

function buildPriceRange(numbers: number[]): {
  low: number;
  median: number;
  high: number;
} {
  const median = calculateMedian(numbers);
  return {
    low: round2(median * 0.85),
    median: round2(median),
    high: round2(median * 1.15),
  };
}

function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
