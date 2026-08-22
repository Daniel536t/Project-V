import { NextResponse } from 'next/server';
import { healCollectorCli } from '@/lib/brightdata';
import { WAYBACK_CONFIG } from '@/lib/wayback';
import { emitLog } from '@/lib/stream';
import { logEraHeal } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const config = WAYBACK_CONFIG;
  const collectorId = config.eraHealCollectorId;

  emitLog('info', `ERA HEAL dispatched · collector ${collectorId} · ${config.retailer} ${config.eraFrom}→${config.eraTo}`);

  const description =
    `The ${config.retailer} product page was redesigned from ${config.eraFrom} to ${config.eraTo}. ` +
    `Price extraction returns empty. Restore extraction of product name, price (number), and in_stock (boolean) ` +
    `from the current live ${config.retailer} page.`;

  const startedAt = Date.now();
  const result = await healCollectorCli(collectorId, description, 420_000);
  const durationMs = Date.now() - startedAt;

  const stdout = result.stdout ?? '';
  const cliDone = /"status"\s*:\s*"done"/.test(stdout) && /save_new_template/.test(stdout);
  const recoveryPath = cliDone ? 'bright-data' : 'local-fallback';

  emitLog(
    cliDone ? 'success' : 'warn',
    `ERA HEAL ${cliDone ? 'completed' : 'did not land'} · ${Math.round(durationMs / 1000)}s · collector ${collectorId}`,
  );

  // Log to era heal ledger
  await logEraHeal({
    collector_id: collectorId,
    era_from: config.eraFrom,
    era_to: config.eraTo,
    era_from_url: config.eraFromUrl,
    era_to_url: config.eraToUrl,
    retailer: config.retailer,
    product_name: config.productName,
    confidence: cliDone ? 92 : 0,
    recovery_seconds: Math.round(durationMs / 1000),
    attempted_heals: 1,
    recovery_path: recoveryPath,
    description: `ERA HEAL ${config.eraFrom}→${config.eraTo} · ${recoveryPath}`,
  });

  return NextResponse.json({
    success: cliDone,
    collectorId,
    durationMs,
    recoveryPath,
    stdout: stdout.slice(-400),
  });
}
