export const APP_NAME = 'SENSE';        // swap to 'BrightAI' in one line if preferred
export const USER_NAME = 'Daniel';
export const USER_PLAN = 'Pro Plan';
export const COLLECTOR_ID = 'c_mt5qg63q1qa9ashdl5';
export const SCRAPE_INTERVAL_S = 30;
/**
 * Nothing watches forever. A watch that FULFILS (alert fires) stands down
 * immediately; one that never triggers retires after this many days.
 * Override with WATCH_TTL_DAYS in the environment.
 */
export const WATCH_TTL_DAYS = Number(process.env.WATCH_TTL_DAYS ?? 7);

/**
 * Base URL for the SENSE runtime (pm2 box) — the box that runs the Bright Data
 * CLI, scheduler, SSE streams, heals, and watch logic. On Vercel serverless,
 * npx and bdata CLI don't exist, so watch/scrape/heal calls must be routed
 * to the long-lived pm2 process. The store UI (rendering, admin controls)
 * stays on Vercel.
 *
 * Defaults to /api (relative — works when browser is on the pm2 box).
 * Set NEXT_PUBLIC_SENSE_RUNTIME_URL in Vercel env to point at the pm2 box.
 */
export const SENSE_RUNTIME_URL =
  process.env.NEXT_PUBLIC_SENSE_RUNTIME_URL ?? '';

/** Domains that are our own store — never scrape these as external URLs. */
export const STORE_DOMAINS = ['sense-rho.vercel.app', 'claude-coder.duckdns.org'];