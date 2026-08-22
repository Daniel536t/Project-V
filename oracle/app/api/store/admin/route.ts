import { NextResponse } from "next/server";
import { getProduct, nextTemplate, toState, updateProduct } from "@/lib/store";
import { scrapeAllWatches } from "@/lib/sense";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const product = await getProduct();
  return NextResponse.json(toState(product));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });

  const action = body.action as string | undefined;

  try {
    let updated;

    if (action === "redesign") {
      const product = await getProduct();
      updated = await updateProduct({ template: nextTemplate(product.template) });
    } else if (action === "set_price") {
      const price = Number(body.value);
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: "value must be a number" }, { status: 400 });
      }
      updated = await updateProduct({ price });
    } else if (action === "set_stock") {
      updated = await updateProduct({ in_stock: Boolean(body.value) });
    } else if (action === "set_stock_level") {
      const level = Number(body.value);
      if (!Number.isFinite(level) || level < 0) {
        return NextResponse.json({ error: "value must be a non-negative number" }, { status: 400 });
      }
      updated = await updateProduct({ stock_level: Math.round(level) });
    } else if (action === "set_bot_detection") {
      updated = await updateProduct({ bot_detection: Boolean(body.value) });
    } else {
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }

    // Demo affordance: any store change immediately drives the next real
    // scrape, so redesign → break → heal (or price → alert) happens live
    // instead of waiting for the scheduler tick.
    void scrapeAllWatches();

    return NextResponse.json(toState(updated));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
