import { NextResponse } from "next/server";
import { selectProduct, toState } from "@/lib/store";
import { createWatchFromIntent, runScrapePass } from "@/lib/sense";
import { deleteAllWatches, getWatches } from "@/lib/db";
import { featuredById } from "@/lib/store-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click "Watch" from the storefront: select the product into the live
// `products` row (so the store + scraper target it), then create a watch and
// run the first real scrape. Single active watch — selecting a new product
// re-targets the watch, so the scrape is always honest.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const productId = body?.product_id as string | undefined;
  if (!productId) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  try {
    const product = await selectProduct(productId);
    const meta = featuredById(productId);
    const target =
      meta?.watchTarget ?? Math.max(1, Math.round(Number(product.price) * 0.9));

    await deleteAllWatches();

    const watch = await createWatchFromIntent({
      label: `${product.name} under $${target}`,
      url: "/api/store/html",
      intent: `Find the price for the ${product.name} on this page`,
      field: "price",
      operator: "<",
      target: String(target),
      query: product.name,
    });

    const run = await runScrapePass(watch.id);

    let message = `Watching ${product.name}.`;
    if (run.value) message += ` Currently ${run.value}.`;
    message += ` I'll tell you the moment the price drops below $${target}.`;

    return NextResponse.json({
      message,
      watch: run.watch,
      watches: await getWatches(),
      events: run.events,
      product: toState(product),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
