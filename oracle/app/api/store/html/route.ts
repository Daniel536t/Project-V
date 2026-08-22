import { NextResponse } from "next/server";
import { getProduct, renderStoreHtml } from "@/lib/store";
import { featuredById } from "@/lib/store-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-rendered HTML representation of the store — the page the scraper
// (and, in production, a Bright Data collector) fetches. Bot detection returns
// a 403 challenge page, mirroring what a bot wall does.
//
// ?product=<id> renders ONLY that product's card (name, price, stock) in the
// current template's DOM semantics — the product-scoped scrape target. One
// product, one price: the collector can never grab a different card's price.
export async function GET(req: Request) {
  const product = await getProduct();

  if (product.bot_detection) {
    const ua = req.headers.get("user-agent") ?? "";
    const isBrowser = /mozilla|chrome|safari|firefox/i.test(ua);
    if (!isBrowser) {
      return new NextResponse(
        `<html><body><h1>403 — Access Denied</h1><p>Please verify you are human.</p></body></html>`,
        { status: 403, headers: { "Content-Type": "text/html" } },
      );
    }
  }

  const url = new URL(req.url);
  const only = url.searchParams.get("product");
  if (only) {
    if (!featuredById(only)) {
      return NextResponse.json({ error: `Unknown product: ${only}` }, { status: 404 });
    }
    return new NextResponse(renderStoreHtml(product, only), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(renderStoreHtml(product), {
    headers: { "Content-Type": "text/html" },
  });
}
