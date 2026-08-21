import { NextResponse } from "next/server";
import { getProduct, renderStoreHtml } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-rendered HTML representation of the store — the page the scraper
// (and, in production, a Bright Data collector) fetches. Bot detection returns
// a 403 challenge page, mirroring what a bot wall does.
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

  return new NextResponse(renderStoreHtml(product), {
    headers: { "Content-Type": "text/html" },
  });
}
