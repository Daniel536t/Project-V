#!/usr/bin/env node
/**
 * Ingest a Bright Data collector's JSON output into scraped_data + yearly_stats.
 *
 * Usage:
 *   node --env-file=.env.local db/ingest.js <file.json> <category>
 *
 * It flattens the collector output, looking for any objects that carry a
 * `title` + `year`, and stores each as a scraped_data row. It then rebuilds
 * yearly_stats (counts per era) for that category so the timeline/ask routes
 * have real aggregated history to serve.
 */
const { Pool } = require("pg");
const fs = require("fs");

const file = process.argv[2];
const category = process.argv[3] || "general";
if (!file) {
  console.error("usage: node db/ingest.js <file.json> <category>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8"));

/** Recursively find `{ title, year }`-shaped objects in the collector output. */
function flatten(x, out = []) {
  if (Array.isArray(x)) {
    x.forEach((v) => flatten(v, out));
    return out;
  }
  if (x && typeof x === "object") {
    if (typeof x.title === "string" && x.year != null) out.push(x);
    else Object.values(x).forEach((v) => flatten(v, out));
  }
  return out;
}

const items = flatten(raw);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  let inserted = 0;
  let skipped = 0;
  for (const it of items) {
    const era = Number(it.year);
    if (!Number.isFinite(era)) continue;
    const title = String(it.title);
    const exists = await pool.query(
      `SELECT 1 FROM scraped_data WHERE title = $1 AND era = $2 AND category = $3`,
      [title, era, category],
    );
    if (exists.rowCount > 0) {
      skipped++;
      continue;
    }
    await pool.query(
      `INSERT INTO scraped_data (era, category, title, metadata, source_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        era,
        category,
        title,
        JSON.stringify({ kind: it.category ?? null, source: "brightdata" }),
        typeof it.url === "string" ? it.url : null,
      ],
    );
    inserted++;
  }

  // Rebuild the per-year aggregate for this category (count of items per era).
  await pool.query(
    `INSERT INTO yearly_stats (year, category, avg_price, median_price, total_items, scarcity_score)
     SELECT era, category, NULL, NULL, COUNT(*), NULL
     FROM scraped_data WHERE category = $1
     GROUP BY era, category
     ON CONFLICT (year, category) DO UPDATE SET total_items = EXCLUDED.total_items`,
    [category],
  );

  console.log(`ingested ${inserted} rows (skipped ${skipped} dups) into scraped_data (category=${category})`);
  await pool.end();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
