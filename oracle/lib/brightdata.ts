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
