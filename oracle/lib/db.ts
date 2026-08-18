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
