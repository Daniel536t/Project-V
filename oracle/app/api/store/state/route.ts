import { NextResponse } from "next/server";
import { getProduct } from "@/lib/store";
import { FEATURED_PRODUCTS } from "@/lib/store-shared";
import { getWatches } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Snapshot of everything the store panel needs: the featured lineup (with the
// active product's live price overlaid), the active template, bot detection,
// and the watch state (which product is watched + its status).
export async function GET() {
  try {
    const active = await getProduct();
    const watches = await getWatches();
    const watch = watches[0] ?? null;

    const products = FEATURED_PRODUCTS.map((f) => ({
      id: f.id,
      name: f.name,
      tagline: f.tagline,
      image: f.image,
      colors: f.colors,
      originalPrice: f.price,
      livePrice: active.id === f.id ? Number(active.price) : null,
      inStock: active.id === f.id ? active.in_stock : null,
    }));

    return NextResponse.json({
      products,
      template: active.template,
      botDetection: active.bot_detection,
      watchedProductId: watch ? active.id : null,
      watchStatus: watch ? watch.status : null,
      collectorId: watch ? (watch.collector_id ?? null) : null,
      scars: watches.reduce((n, w) => n + (w.scar_count ?? 0), 0),
    });
  } catch (e) {
    return NextResponse.json(
      {
        products: [],
        template: "A",
        botDetection: false,
        watchedProductId: null,
        watchStatus: null,
        collectorId: null,
        scars: 0,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
