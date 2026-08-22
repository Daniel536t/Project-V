import { Pool } from "pg";

// ---- Row types (mirror db/schema.sql) ----

export interface ScrapedData {
  id: number;
  era: number;
  category: string | null;
  title: string | null;
  price: string | null;
  availability: string | null;
  metadata: Record<string, unknown> | null;
  scraped_at: Date;
  source_url: string | null;
}

export interface HealLedgerRow {
  id: number;
  collector_id: string | null;
  era: number | null;
  broke_at: Date | null;
  healed_at: Date | null;
  description: string | null;
  error_message: string | null;
  recovery_steps: Record<string, unknown> | null;
  rows_recovered: number | null;
  attempted_heals: number | null;
  recovery_path: string | null;
}

export interface YearlyStats {
  year: number;
  category: string;
  avg_price: string | null;
  median_price: string | null;
  total_items: number;
  scarcity_score: string | null;
}

export interface UserQueryRow {
  id: number;
  query_text: string | null;
  query_type: string | null;
  response: Record<string, unknown> | null;
  created_at: Date;
}

// ---- Pool singleton ----

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set — add it to .env.local");
    }
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/**
 * Spec-compatible generic query helper (Batch 7).
 * Runs a parameterized query against the pool and returns the rows.
 */
export async function queryDatabase<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  return query<T>(text, params);
}

// ---- Domain queries ----

export async function getYearlyStats(
  category?: string,
): Promise<YearlyStats[]> {
  const { rows } = await getPool().query<YearlyStats>(
    category
      ? `SELECT * FROM yearly_stats WHERE category = $1 ORDER BY year ASC`
      : `SELECT * FROM yearly_stats ORDER BY year ASC, category ASC`,
    category ? [category] : [],
  );
  return rows;
}

export async function getTimeSeries(
  category: string,
): Promise<ScrapedData[]> {
  return query<ScrapedData>(
    `SELECT * FROM scraped_data
     WHERE category = $1 AND price IS NOT NULL
     ORDER BY era ASC, scraped_at ASC`,
    [category],
  );
}

export async function searchEra(
  queryText: string,
  limit = 50,
): Promise<ScrapedData[]> {
  return query<ScrapedData>(
    `SELECT * FROM scraped_data
     WHERE title ILIKE $1 OR category ILIKE $1
     ORDER BY era DESC
     LIMIT $2`,
    [`%${queryText}%`, limit],
  );
}

export async function recordUserQuery(
  queryText: string,
  queryType: string,
  response: unknown,
): Promise<UserQueryRow[]> {
  return query<UserQueryRow>(
    `INSERT INTO user_queries (query_text, query_type, response)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [queryText, queryType, JSON.stringify(response)],
  );
}

export async function logHeal(
  entry: Omit<HealLedgerRow, "id">,
): Promise<HealLedgerRow[]> {
  return query<HealLedgerRow>(
    `INSERT INTO heal_ledger
       (collector_id, era, broke_at, healed_at, description, error_message, recovery_steps, rows_recovered)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      entry.collector_id,
      entry.era,
      entry.broke_at,
      entry.healed_at,
      entry.description,
      entry.error_message,
      entry.recovery_steps ? JSON.stringify(entry.recovery_steps) : null,
      entry.rows_recovered,
    ],
  );
}

export async function getHealLedger(): Promise<HealLedgerRow[]> {
  return query<HealLedgerRow>(
    `SELECT * FROM heal_ledger ORDER BY id DESC LIMIT 100`,
  );
}

// ---- Watches (SENSE) ----

export interface WatchRow {
  id: string;
  label: string | null;
  url: string;
  intent: string | null;
  field: string;
  operator: string;
  target: string | null;
  status: string;
  last_value: string | null;
  selector: string | null;
  scar_count: number;
  query: string | null;
  last_checked_at: Date | null;
  next_check_at: Date | null;
  collector_id: string | null;
  product_name: string | null;
  source: string;
  last_condition_met: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getWatches(): Promise<WatchRow[]> {
  return query<WatchRow>(`SELECT * FROM watches ORDER BY created_at DESC`);
}

export async function getWatch(id: string): Promise<WatchRow | null> {
  const rows = await query<WatchRow>(`SELECT * FROM watches WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createWatch(
  w: Pick<WatchRow, "id" | "url" | "field" | "operator"> &
    Partial<
      Pick<
        WatchRow,
        | "label"
        | "intent"
        | "target"
        | "selector"
        | "query"
        | "status"
        | "next_check_at"
        | "collector_id"
        | "product_name"
        | "source"
      >
    >,
): Promise<WatchRow> {
  const rows = await query<WatchRow>(
    `INSERT INTO watches (id, label, url, intent, field, operator, target, selector, query, status, next_check_at, collector_id, product_name, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      w.id,
      w.label ?? null,
      w.url,
      w.intent ?? null,
      w.field,
      w.operator,
      w.target ?? null,
      w.selector ?? null,
      w.query ?? null,
      w.status ?? "waiting",
      w.next_check_at ?? null,
      w.collector_id ?? null,
      w.product_name ?? null,
      w.source ?? "store",
    ],
  );
  return rows[0];
}

const WATCH_EDITABLE = new Set([
  "label",
  "url",
  "intent",
  "field",
  "operator",
  "target",
  "status",
  "last_value",
  "selector",
  "scar_count",
  "query",
  "last_checked_at",
  "next_check_at",
  "collector_id",
  "product_name",
  "source",
  "last_condition_met",
]);

export async function updateWatch(
  id: string,
  patch: Partial<
    Pick<
      WatchRow,
      | "label"
      | "url"
      | "intent"
      | "field"
      | "operator"
      | "target"
      | "status"
      | "last_value"
      | "selector"
      | "scar_count"
      | "query"
      | "last_checked_at"
      | "next_check_at"
      | "collector_id"
      | "product_name"
      | "source"
      | "last_condition_met"
    >
  >,
): Promise<WatchRow | null> {
  const entries = Object.entries(patch).filter(([k]) => WATCH_EDITABLE.has(k));
  if (entries.length === 0) return getWatch(id);
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
  const values = entries.map(([, v]) => v);
  const rows = await query<WatchRow>(
    `UPDATE watches SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  return rows[0] ?? null;
}

export async function deleteWatch(id: string): Promise<boolean> {
  const res = await getPool().query(`DELETE FROM watches WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function deleteAllWatches(): Promise<number> {
  const res = await getPool().query(`DELETE FROM watches`);
  return res.rowCount ?? 0;
}

export async function deleteWatchesBySource(source: string): Promise<number> {
  const res = await getPool().query(`DELETE FROM watches WHERE source = $1`, [source]);
  return res.rowCount ?? 0;
}

// ---- Scrape history (SENSE) ----

export interface ScrapeHistoryRow {
  id: number;
  watch_id: string | null;
  price: string | null;
  in_stock: boolean | null;
  raw: Record<string, unknown> | null;
  scraped_at: Date;
}

export async function logScrape(
  watchId: string,
  price: number | null,
  inStock: boolean | null,
  raw: unknown,
): Promise<ScrapeHistoryRow[]> {
  return query<ScrapeHistoryRow>(
    `INSERT INTO scrape_history (watch_id, price, in_stock, raw)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [watchId, price, inStock, JSON.stringify(raw ?? {})],
  );
}

export async function getScrapeHistory(
  watchId: string,
  limit = 100,
): Promise<ScrapeHistoryRow[]> {
  return query<ScrapeHistoryRow>(
    `SELECT * FROM scrape_history WHERE watch_id = $1 ORDER BY id DESC LIMIT $2`,
    [watchId, limit],
  );
}

// ---- Structured heal events (SENSE: the Scar Log) ----

export interface StructuredHeal {
  watch_id: string | null;
  collector_id: string | null;
  broke_at: Date;
  healed_at: Date;
  original_intent: string | null;
  old_selector: string | null;
  new_selector: string | null;
  confidence: number | null;
  recovery_seconds: number | null;
  attempted_heals: number | null;
  recovery_path: string | null;
  description: string | null;
  error_message: string | null;
}

export async function logStructuredHeal(h: StructuredHeal): Promise<HealLedgerRow[]> {
  return query<HealLedgerRow>(
    `INSERT INTO heal_ledger
       (watch_id, collector_id, broke_at, healed_at, original_intent,
        old_selector, new_selector, confidence, recovery_seconds,
        attempted_heals, recovery_path, description, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      h.watch_id,
      h.collector_id,
      h.broke_at,
      h.healed_at,
      h.original_intent,
      h.old_selector,
      h.new_selector,
      h.confidence,
      h.recovery_seconds,
      h.attempted_heals,
      h.recovery_path,
      h.description,
      h.error_message,
    ],
  );
}

export interface ScarLogRow {
  id: number;
  watch_id: string | null;
  collector_id: string | null;
  broke_at: Date | null;
  healed_at: Date | null;
  original_intent: string | null;
  old_selector: string | null;
  new_selector: string | null;
  confidence: number | null;
  recovery_seconds: number | null;
  attempted_heals: number | null;
  recovery_path: string | null;
  description: string | null;
  error_message: string | null;
}

export async function getScarLog(): Promise<ScarLogRow[]> {
  return query<ScarLogRow>(
    `SELECT id, watch_id, collector_id, broke_at, healed_at, original_intent,
            old_selector, new_selector, confidence, recovery_seconds,
            attempted_heals, recovery_path, description, error_message
     FROM heal_ledger
     WHERE watch_id IS NOT NULL
     ORDER BY id DESC
     LIMIT 100`,
  );
}

export async function getTotalScarCount(): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM heal_ledger WHERE watch_id IS NOT NULL`,
  );
  return Number(rows[0]?.n ?? 0);
}
