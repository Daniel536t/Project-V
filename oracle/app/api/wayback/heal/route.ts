import { NextResponse } from 'next/server';
import {
  healCollectorCli,
  runCollectorCli,
  type HealCliResult,
} from '@/lib/brightdata';
import { WAYBACK_CONFIG } from '@/lib/wayback';
import { emitLog } from '@/lib/stream';
import { logEraHeal } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- Refresh-job gate ----
// Bright Data executes heals as async refresh jobs with a concurrency cap of
// ONE per collector. A heal dispatched while another job is running is rejected
// in ~3s with "Another refresh job is already running". That rejection is NOT a
// failed heal — it's a gate wait. Poll until the gate clears, then dispatch.

const GATE_POLL_MS = 20_000;
const GATE_MAX_WAIT_MS = 120_000;

function isJobBusy(stdout: string): boolean {
  return /Another (?:refresh|refactor) job is (?:already|still) in progress/i.test(stdout);
}

function cliDone(result: HealCliResult): boolean {
  if (result.code !== 0 || result.timedOut) return false;
  const text = result.stdout ?? '';
  return /"status"\s*:\s*"done"/.test(text) && /save_new_template/.test(text);
}

/**
 * Dispatch the heal, waiting for the refresh-job gate to clear if needed.
 * Returns the CLI result of the dispatch the planner actually accepted, or
 * null if the gate never cleared within GATE_MAX_WAIT_MS.
 */
async function dispatchGatedHeal(
  collectorId: string,
  description: string,
): Promise<HealCliResult | null> {
  const deadline = Date.now() + GATE_MAX_WAIT_MS;
  let waitedForGate = false;

  while (true) {
    const result = await healCollectorCli(collectorId, description, 420_000);

    if (isJobBusy(result.stdout ?? '')) {
      waitedForGate = true;
      emitLog('info', '⏳ Bright Data refresh job still running — waiting for clear');
      if (Date.now() + GATE_POLL_MS > deadline) {
        emitLog('warn', '⚠️ Refresh job never cleared within 120s — era heal aborted');
        return null;
      }
      await new Promise((r) => setTimeout(r, GATE_POLL_MS));
      continue;
    }

    if (waitedForGate) emitLog('info', '✅ Refresh job cleared — dispatching era heal now');
    return result;
  }
}

/** Wait for the Bright Data refresh job, then run a verification scrape. */
async function verifyExtraction(
  collectorId: string,
  url: string,
  expectedPrice: number,
): Promise<{ verified: boolean; price: number | null }> {
  emitLog('info', '⏳ Waiting 45s for template refresh…');
  await new Promise((r) => setTimeout(r, 45_000));

  for (let attempt = 1; attempt <= 3; attempt++) {
    emitLog('info', `⏳ Post-heal verification (attempt ${attempt}/3)…`);
    const raw = await runCollectorCli(collectorId, url, 180_000);
    if (raw != null) {
      const data = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
      const price = typeof data.price === 'number' ? data.price : null;
      if (price != null && price > 0 && Math.abs(price - expectedPrice) < 1) {
        emitLog('success', `✅ Post-heal verification passed · price=$${price}`);
        return { verified: true, price };
      }
      emitLog('warn', `Post-heal price=$${price ?? 0} — not matching expected $${expectedPrice}`);
    } else {
      emitLog('warn', `Post-heal scrape returned no data (attempt ${attempt})`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 15_000));
  }
  emitLog('warn', 'Post-heal verification failed — extraction did not restore');
  return { verified: false, price: null };
}

export async function POST() {
  const config = WAYBACK_CONFIG;
  const collectorId = config.eraHealCollectorId;

  emitLog('info', `ERA HEAL dispatched · collector ${collectorId} · ${config.retailer} ${config.eraFrom}→${config.eraTo}`);

  const description =
    `The ${config.retailer} product page was redesigned from ${config.eraFrom} to ${config.eraTo}. ` +
    `Price extraction returns empty. Restore extraction of product name, price (number), and in_stock (boolean) ` +
    `from the current live ${config.retailer} page.`;

  const startedAt = Date.now();

  // Gated dispatch — never fire into a busy refresh job.
  const result = await dispatchGatedHeal(collectorId, description);

  if (result == null) {
    const durationMs = Date.now() - startedAt;
    emitLog('warn', `ERA HEAL aborted · refresh job never cleared · ${Math.round(durationMs / 1000)}s`);
    await logEraHeal({
      collector_id: collectorId, era_from: config.eraFrom, era_to: config.eraTo,
      era_from_url: config.eraFromUrl, era_to_url: config.eraToUrl,
      retailer: config.retailer, product_name: config.productName,
      confidence: 0, recovery_seconds: Math.round(durationMs / 1000),
      attempted_heals: 0, recovery_path: 'local-fallback',
      description: `ERA HEAL ${config.eraFrom}→${config.eraTo} · aborted · refresh job never cleared within 120s`,
    });
    return NextResponse.json({ success: false, collectorId, durationMs, recoveryPath: 'local-fallback', aborted: true });
  }

  const stdout = result.stdout ?? '';

  if (!cliDone(result)) {
    const durationMs = Date.now() - startedAt;
    emitLog('warn', `ERA HEAL did not land · ${Math.round(durationMs / 1000)}s`);
    await logEraHeal({
      collector_id: collectorId, era_from: config.eraFrom, era_to: config.eraTo,
      era_from_url: config.eraFromUrl, era_to_url: config.eraToUrl,
      retailer: config.retailer, product_name: config.productName,
      confidence: 0, recovery_seconds: Math.round(durationMs / 1000),
      attempted_heals: 1, recovery_path: 'local-fallback',
      description: `ERA HEAL ${config.eraFrom}→${config.eraTo} · local-fallback · CLI did not complete`,
    });
    return NextResponse.json({ success: false, collectorId, durationMs, recoveryPath: 'local-fallback', stdout: stdout.slice(-400) });
  }

  // CLI completed — now VERIFY extraction actually works.
  const { verified, price } = await verifyExtraction(collectorId, config.eraToUrl, 1999);
  const durationMs = Date.now() - startedAt;
  const recoveryPath = verified ? 'bright-data' : 'local-fallback';

  emitLog(
    verified ? 'success' : 'warn',
    `ERA HEAL ${verified ? 'VERIFIED — extraction restored' : 'CLI done but extraction did NOT restore'} · ${Math.round(durationMs / 1000)}s`,
  );

  await logEraHeal({
    collector_id: collectorId, era_from: config.eraFrom, era_to: config.eraTo,
    era_from_url: config.eraFromUrl, era_to_url: config.eraToUrl,
    retailer: config.retailer, product_name: config.productName,
    confidence: verified ? 92 : 0, recovery_seconds: Math.round(durationMs / 1000),
    attempted_heals: 1, recovery_path: recoveryPath,
    description: verified
      ? `ERA HEAL ${config.eraFrom}→${config.eraTo} · bright-data · verified price=$${price}`
      : `ERA HEAL ${config.eraFrom}→${config.eraTo} · local-fallback · CLI save_new_template completed but post-heal scrape returned price=0`,
  });

  return NextResponse.json({ success: verified, collectorId, durationMs, recoveryPath, stdout: stdout.slice(-400) });
}
