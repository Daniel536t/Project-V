import { NextResponse } from 'next/server';
import { runCollectorCli } from '@/lib/brightdata';
import { WAYBACK_CONFIG, type WaybackEraResult } from '@/lib/wayback';
import { emitLog } from '@/lib/stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const era = body?.era as number | undefined;
  if (era !== 2019 && era !== 2026) {
    return NextResponse.json({ error: 'era must be 2019 or 2026' }, { status: 400 });
  }

  const config = WAYBACK_CONFIG;
  const collectorId = era === 2019 ? config.eraFromCollectorId : config.eraToCollectorId;
  const url = era === 2019 ? config.eraFromUrl : config.eraToUrl;
  emitLog('info', `Era scrape · ${era} · ${config.retailer} · collector ${collectorId}…`);

  const raw = await runCollectorCli(collectorId, url, 240_000);

  if (raw == null) {
    emitLog('error', `Era scrape ${era} failed — collector returned no data`);
    return NextResponse.json({ error: 'Collector returned no data' }, { status: 502 });
  }

  // Parse the result envelope
  const data = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  const productName = String(data.product_name ?? data.name ?? data.title ?? '');
  const price = typeof data.price === 'number' ? data.price : null;
  const inStock =
    typeof data.in_stock === 'boolean'
      ? data.in_stock
      : typeof data.in_stock === 'string'
        ? /true/i.test(data.in_stock)
        : null;

  const result: WaybackEraResult = {
    era,
    collectorId,
    productName: productName || null,
    price,
    inStock,
    raw: data,
    timestamp: Date.now(),
  };

  emitLog(
    'success',
    `✅ Era ${era} · ${productName || 'unknown'} · $${price ?? '?'} · stock=${inStock ?? '?'} · via brightdata-collector`,
  );

  return NextResponse.json(result);
}
