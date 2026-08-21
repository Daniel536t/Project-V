import { NextResponse } from "next/server";
import { getWatch } from "@/lib/db";
import { getProduct, TEMPLATES } from "@/lib/store";
import { logStructuredHeal } from "@/lib/db";
import { updateWatch } from "@/lib/db";
import { emitLog } from "@/lib/stream";
import { runScrapePass } from "@/lib/sense";

export const runtime = "nodejs";

// Manual heal: re-derive the selector from the original intent against the
// current store template, log a scar, and re-scrape. Same collector ID.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const watch = await getWatch(params.id);
  if (!watch) return NextResponse.json({ error: "not found" }, { status: 404 });

  const product = await getProduct();
  const t = TEMPLATES[product.template] ?? TEMPLATES.A;
  const field = watch.field === "stock" ? "stock" : "price";
  const newSelector = field === "price" ? t.priceSelector : t.stockSelector;
  const oldSelector = watch.selector;
  const brokeAt = new Date();

  emitLog("info", `Heal protocol · intent: "${watch.intent}"`);
  emitLog("info", `Bright Data heal dispatched (collector ${watch.collector_id})`);

  await updateWatch(params.id, {
    selector: newSelector,
    status: "healing",
    scar_count: (watch.scar_count ?? 0) + 1,
  });

  const healedAt = new Date();
  const recoverySeconds = Math.max(1, Math.round((healedAt.getTime() - brokeAt.getTime()) / 1000));
  const confidence = TEMPLATES[product.template] ? 94 : 78;

  await logStructuredHeal({
    watch_id: params.id,
    collector_id: watch.collector_id,
    broke_at: brokeAt,
    healed_at: healedAt,
    original_intent: watch.intent,
    old_selector: oldSelector,
    new_selector: newSelector,
    confidence,
    recovery_seconds: recoverySeconds,
    description: `Scar #${(watch.scar_count ?? 0) + 1} — manual heal`,
    error_message: `Selector "${oldSelector}" no longer matches template ${product.template}`,
  });

  emitLog("success", `Healed · ${field} now at ${newSelector} · confidence ${confidence}%`);

  const run = await runScrapePass(params.id);
  return NextResponse.json({ watch: run.watch, healed: true });
}
