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

export interface BrightWebResult {
  title: string;
  url: string;
  description: string;
}

export interface BrightImageResult {
  title: string;
  url: string;
  source_url: string;
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
): Promise<BrightSearchResult> {
  if (!BRIGHT_DATA_API_KEY || !SERP_ZONE) {
    throw new Error(
      "Bright Data SERP is not configured (BRIGHT_DATA_API_KEY + BRIGHT_DATA_SERP_ZONE)",
    );
  }

  const q = encodeURIComponent(query);
  const [web, images] = await Promise.all([
    serpRequest(`https://www.google.com/search?q=${q}&hl=en&gl=us`),
    serpRequest(`https://www.google.com/search?q=${q}&tbm=isch&hl=en&gl=us`),
  ]);

  return { web: parseWeb(web), images: parseImages(images) };
}

async function serpRequest(googleUrl: string): Promise<unknown> {
  const res = await fetch(SERP_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
    },
    body: JSON.stringify({
      zone: SERP_ZONE,
      url: googleUrl,
      format: "raw",
      data_format: "parsed_light",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Bright Data SERP ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return await res.json();
}

function parseWeb(data: unknown): BrightWebResult[] {
  const d = data as {
    organic?: Array<{ title?: string; link?: string; description?: string }>;
  };
  return (d.organic ?? [])
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      description: r.description ?? "",
    }))
    .filter((r) => r.url);
}

function parseImages(data: unknown): BrightImageResult[] {
  const d = data as {
    images?: Array<Record<string, unknown>>;
    organic?: Array<Record<string, unknown>>;
  };
  const rows = (d.images ?? d.organic ?? []) as Array<Record<string, unknown>>;
  return rows
    .map((r) => {
      const url = firstString(r.image, r.url, r.link, r.original, r.thumbnail);
      const source_url = firstString(r.source_url, r.source, r.link, r.url);
      const title = firstString(r.title, r.alt, r.snippet);
      return { title, url, source_url };
    })
    .filter((r) => r.url.startsWith("http"));
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
