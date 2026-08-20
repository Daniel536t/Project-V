import { NextResponse } from "next/server";
import {
  DEMO_TEMPLATES,
  getDemoState,
  resetDemo,
  setDemoState,
} from "@/lib/sense";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ...getDemoState(), templates: DEMO_TEMPLATES });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.reset) {
    return NextResponse.json(resetDemo());
  }
  const patch: Parameters<typeof setDemoState>[0] = {};
  if (typeof body.template === "number") patch.template = body.template;
  if (typeof body.botDetection === "boolean") patch.botDetection = body.botDetection;
  const productPatch: { price?: number; inStock?: boolean } = {};
  if (typeof body.price === "number") productPatch.price = body.price;
  if (typeof body.inStock === "boolean") productPatch.inStock = body.inStock;
  if (Object.keys(productPatch).length) patch.product = productPatch;
  return NextResponse.json(setDemoState(patch));
}
