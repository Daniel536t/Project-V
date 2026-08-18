// Bright Data "Web Scraper API" (formerly Data Collector) wrapper.
// Docs: https://docs.brightdata.com/scraping-automation/web-scraper-api/

const BASE = "https://api.brightdata.com";

function apiKey(): string {
  const key = process.env.BRIGHT_DATA_API_KEY;
  if (!key) throw new Error("BRIGHT_DATA_API_KEY is not set");
  return key;
}

function collectorId(): string {
  const id = process.env.BRIGHT_DATA_COLLECTOR_ID;
  if (!id) throw new Error("BRIGHT_DATA_COLLECTOR_ID is not set");
  return id;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
}

/** Trigger a collector run with optional input (URLs, search terms, etc.). */
export async function triggerCollector(input?: unknown): Promise<unknown> {
  const res = await fetch(
    `${BASE}/dca/trigger?collector=${collectorId()}`,
    {
      method: "POST",
      headers: headers(),
      body: input ? JSON.stringify(input) : undefined,
    },
  );
  if (!res.ok) {
    throw new Error(`Bright Data trigger error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Fetch the latest dataset produced by the collector. */
export async function getDataset(): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${BASE}/dca/dataset?collector=${collectorId()}`,
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Bright Data dataset error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export const brightdata = { triggerCollector, getDataset };
