import { scrapeDueWatches } from "./sense";

let started = false;

/**
 * In-process scheduler (single process under pm2). Ticks every 20s and runs
 * any watch whose next_check_at is due — so breaks and alerts happen live
 * during the demo without a user clicking anything.
 */
export function ensureScheduler(): void {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      await scrapeDueWatches();
    } catch {
      /* transient DB error — retry on next tick */
    }
  };

  setInterval(tick, 20_000);
  void tick();
}
