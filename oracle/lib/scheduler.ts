import { getWatches } from "./db";
import { checkWatch } from "./sense";

let started = false;

/**
 * In-process scheduler (single process under pm2). Ticks every 20s and runs
 * any watch whose next_check_at is due, skipping ones already alerting or
 * mid-check. This is the "it polls while you sleep" part of the product.
 */
export function ensureScheduler(): void {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const watches = await getWatches();
      const now = Date.now();
      for (const w of watches) {
        const next = w.next_check_at
          ? new Date(w.next_check_at).getTime()
          : null;
        const due = next == null || next <= now;
        const idle = w.status !== "alerted" && w.status !== "checking";
        if (due && idle) {
          checkWatch(w.id).catch(() => {
            /* a failed check will retry on a later tick */
          });
        }
      }
    } catch {
      /* ignore transient DB errors */
    }
  };

  setInterval(tick, 20_000);
  void tick();
}
