import { NextResponse } from 'next/server';
import { getEraHealLedger } from '@/lib/db';
import { WAYBACK_CONFIG } from '@/lib/wayback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const heals = await getEraHealLedger();
  return NextResponse.json({
    config: WAYBACK_CONFIG,
    heals,
  });
}
