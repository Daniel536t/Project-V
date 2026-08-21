import { NextResponse } from "next/server";
import { getProduct, nextTemplate, toState, updateProduct } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const product = await getProduct();
  return NextResponse.json(toState(product));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });

  const action = body.action as string | undefined;

  try {
    if (action === "redesign") {
      const product = await getProduct();
      const updated = await updateProduct({ template: nextTemplate(product.template) });
      return NextResponse.json(toState(updated));
    }

    if (action === "set_price") {
      const price = Number(body.value);
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: "value must be a number" }, { status: 400 });
      }
      const updated = await updateProduct({ price });
      return NextResponse.json(toState(updated));
    }

    if (action === "set_stock") {
      const updated = await updateProduct({ in_stock: Boolean(body.value) });
      return NextResponse.json(toState(updated));
    }

    if (action === "set_bot_detection") {
      const updated = await updateProduct({ bot_detection: Boolean(body.value) });
      return NextResponse.json(toState(updated));
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
