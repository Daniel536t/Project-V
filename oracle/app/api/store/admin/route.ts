import { NextResponse } from "next/server";
import {
  getProduct,
  selectProduct,
  toState,
  updateProduct,
  TEMPLATE_ORDER,
} from "@/lib/store";
import { scrapeAllWatches } from "@/lib/sense";
import { deleteAllWatches, getPool } from "@/lib/db";
import { emitLog, emitStore } from "@/lib/stream";

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

    if (action === "select_product") {
      const productId = body.productId as string | undefined;
      if (!productId) {
        return NextResponse.json({ error: "productId is required" }, { status: 400 });
      }
      updated = await selectProduct(productId);
    } else if (action === "redesign") {
      const template = body.template as string | undefined;
      if (template && TEMPLATE_ORDER.includes(template as (typeof TEMPLATE_ORDER)[number])) {
        updated = await updateProduct({ template });
      } else {
        // Backwards-compatible: cycle to the next template.
        const product = await getProduct();
        const i = TEMPLATE_ORDER.indexOf(product.template as (typeof TEMPLATE_ORDER)[number]);
        const next = TEMPLATE_ORDER[(i + 1) % TEMPLATE_ORDER.length];
        updated = await updateProduct({ template: next });
      }
    } else if (action === "set_price") {
      const price = Number(body.price ?? body.value);
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: "price must be a number" }, { status: 400 });
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
    } else if (action === "reset_demo") {
      // Full demo reset: product to $999/A/in-stock, clear all watches/scars/history
      await updateProduct({ price: 999, in_stock: true, template: "A", bot_detection: false });
      await deleteAllWatches();
      await getPool().query("DELETE FROM heal_ledger");
      await getPool().query("DELETE FROM scrape_history");
      updated = await getProduct();
      emitLog("info", "Demo state reset → $999 · Template A · clean");
      emitStore(toState(updated));
      return NextResponse.json({ status: "reset", ...toState(updated) });
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
