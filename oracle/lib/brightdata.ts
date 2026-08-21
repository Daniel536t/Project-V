// Bright Data Web Scraper API wrapper (Batch 4).
// Docs: https://docs.brightdata.com/scraping-automation/web-scraper-api/

const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;
const COLLECTOR_ID = process.env.BRIGHT_DATA_COLLECTOR_ID;

function requireKey(): string {
  if (!BRIGHT_DATA_API_KEY) {
    throw new Error("BRIGHT_DATA_API_KEY is not set — add it to .env.local");
  }
  return BRIGHT_DATA_API_KEY;
}

function requireCollectorId(): string {
  if (!COLLECTOR_ID) {
    throw new Error("BRIGHT_DATA_COLLECTOR_ID is not set — add it to .env.local");
  }
  return COLLECTOR_ID;
}

/** Trigger a scrape of a single URL through the Bright Data collector. */
export async function triggerScrape(url: string): Promise<unknown> {
  const response = await fetch("https://api.brightdata.com/dca/trigger", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collector_id: requireCollectorId(),
      url,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bright Data API error: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Self-healing is performed via the CLI (AI self-heal in place), not the API.
 * This documents the process; it can be shelled out to in a real run.
 */
export async function healScraper(description: string): Promise<string> {
  const command = `bdata scraper heal ${requireCollectorId()} "${description}"`;
  console.log(`To heal the scraper, run: ${command}`);
  return command;
}

/**
 * CLI helpers — the documented Bright Data path for running and healing
 * scrapers. The CLI must be pre-authenticated (BRIGHTDATA_API_KEY). These are
 * used by the store collector (`BRIGHT_DATA_STORE_COLLECTOR_ID`) so production
 * heals genuinely go through `bdata scraper heal`.
 */
function cliEnv() {
  return {
    ...process.env,
    BRIGHTDATA_API_KEY: process.env.BRIGHT_DATA_API_KEY ?? "",
  };
}

async function runCli(args: string[], timeoutMs = 300_000): Promise<{ stdout: string; code: number; timedOut: boolean }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("npx", ["-y", "-p", "@brightdata/cli", "bdata", ...args], {
      env: cliEnv(),
      shell: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ stdout: stdout || stderr, code: -1, timedOut: true });
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout || stderr, code: code ?? -1, timedOut: false });
    });
  });
}

/**
 * Run a collector against a URL synchronously (server-side 25–50s cap).
 * Returns the parsed JSON the collector produced, or null on failure.
 */
export async function runCollectorCli(
  collectorId: string,
  url: string,
  timeoutMs = 70_000,
): Promise<Record<string, unknown> | null> {
  const { stdout, code } = await runCli(
    ["scraper", "run", collectorId, url, "--sync", "--json"],
    timeoutMs,
  );
  if (code !== 0) return null;
  try {
    const parsed = JSON.parse(stdout);
    // The envelope wraps the result; unwrap the common shapes.
    if (parsed?.data != null) return parsed.data;
    if (parsed?.result != null) return parsed.result;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Heal a collector in place via the CLI (AI self-heal from the original
 * intent). Uses --auto-approve so the heal polls through to done. Returns the
 * CLI output envelope so callers can surface the healed selector/status.
 */
export async function healCollectorCli(
  collectorId: string,
  intent: string,
  timeoutMs = 300_000,
): Promise<{ stdout: string; code: number; timedOut: boolean }> {
  return runCli(
    ["scraper", "heal", collectorId, intent, "--auto-approve", "--json"],
    timeoutMs,
  );
}

/** Scrape a historical snapshot of a page from the Wayback Machine. */
export async function scrapeWaybackSnapshot(
  year: number,
  originalUrl: string,
): Promise<unknown> {
  const waybackUrl = `https://web.archive.org/web/${year}/${originalUrl}`;
  return await triggerScrape(waybackUrl);
}

// ---- Bright Data SERP API (search anything) ----

const SERP_BASE = "https://api.brightdata.com/request";
const SERP_ZONE = process.env.BRIGHT_DATA_SERP_ZONE;

// In-memory TTL cache — live search costs Bright Data credit, so reuse results
// for a few minutes. (Single-process cache: fine for pm2; on serverless it is
// per-instance and short-lived.)
interface CacheEntry {
  result: BrightSearchResult;
  expires: number;
}
const serpCache = new Map<string, CacheEntry>();
const SERP_CACHE_TTL_MS = 10 * 60 * 1000;

export interface BrightWebResult {
  title: string;
  url: string;
  description: string;
}

export interface BrightImageResult {
  title: string;
  url: string;
  source_url: string;
  /** Raw source caption (may contain a date). */
  source?: string;
}

export interface BrightSearchResult {
  web: BrightWebResult[];
  images: BrightImageResult[];
}

/**
 * Search the live web (Google via Bright Data SERP API) for any query.
 * Returns web results (articles) + image results. Throws if not configured,
 * so callers can fall back gracefully.
 */
export async function searchBrightData(
  query: string,
  opts?: { refresh?: boolean },
): Promise<BrightSearchResult> {
  if (!BRIGHT_DATA_API_KEY || !SERP_ZONE) {
    throw new Error(
      "Bright Data SERP is not configured (BRIGHT_DATA_API_KEY + BRIGHT_DATA_SERP_ZONE)",
    );
  }

  const key = query.trim().toLowerCase();
  if (!opts?.refresh) {
    const hit = serpCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.result;
  }

  const q = encodeURIComponent(query);
  // Web search + Google Image search. `udm=2` is Google's current image tab
  // (the old `tbm=isch` returns an empty body through the SERP parser).
  const [web, images] = await Promise.all([
    serpRequest(`https://www.google.com/search?q=${q}&hl=en&gl=us`),
    serpRequest(`https://www.google.com/search?q=${q}&udm=2&hl=en&gl=us`),
  ]);

  const result = { web: parseWeb(web), images: parseImages(images) };
  serpCache.set(key, { result, expires: Date.now() + SERP_CACHE_TTL_MS });
  return result;
}

/**
 * The /request endpoint (format=json + data_format=parsed) wraps the parsed
 * result in a `body` JSON string. Unwrap it here.
 */
async function serpRequest(
  googleUrl: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(SERP_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
    },
    body: JSON.stringify({
      zone: SERP_ZONE,
      url: googleUrl,
      format: "json",
      data_format: "parsed",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Bright Data SERP ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const raw = (await res.json()) as {
    body?: string | Record<string, unknown>;
  };
  const body =
    typeof raw.body === "string" ? JSON.parse(raw.body) : (raw.body ?? raw);
  return (body ?? {}) as Record<string, unknown>;
}

function parseWeb(body: Record<string, unknown>): BrightWebResult[] {
  const organic = body.organic as
    | Array<{ title?: string; link?: string; description?: string }>
    | undefined;
  return (organic ?? [])
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      description: r.description ?? "",
    }))
    .filter((r) => r.url.startsWith("http"));
}

function parseImages(body: Record<string, unknown>): BrightImageResult[] {
  const rows = (body.images ?? []) as Array<Record<string, unknown>>;
  return rows
    .map((r) => {
      // NOTE: r.image / r.image_base64 are huge base64 blobs — never return them.
      const url = firstString(r.original_image, r.image_url, r.thumbnail);
      const source_url = firstString(r.link, r.source_url, r.source);
      const title = firstString(r.image_alt, r.title, r.source);
      const source = firstString(r.source);
      return { title, url, source_url, source };
    })
    .filter((r) => r.url.startsWith("http"));
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Human-friendly hostname of a URL, e.g. "www.nippon.com" → "nippon.com". */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
