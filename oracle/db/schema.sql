-- ORACLE database schema
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql

-- Historical scraped data
CREATE TABLE IF NOT EXISTS scraped_data (
  id SERIAL PRIMARY KEY,
  era INTEGER NOT NULL,
  category VARCHAR(100),
  title VARCHAR(500),
  price DECIMAL,
  availability VARCHAR(50),
  metadata JSONB,
  scraped_at TIMESTAMP DEFAULT NOW(),
  source_url TEXT
);

-- Healing ledger (proof of self-healing)
CREATE TABLE IF NOT EXISTS heal_ledger (
  id SERIAL PRIMARY KEY,
  collector_id VARCHAR(50),
  era INTEGER,
  broke_at TIMESTAMP,
  healed_at TIMESTAMP,
  description TEXT,
  error_message TEXT,
  recovery_steps JSONB,
  rows_recovered INTEGER
);

-- Aggregated stats for fast queries
CREATE TABLE IF NOT EXISTS yearly_stats (
  year INTEGER,
  category VARCHAR(100),
  avg_price DECIMAL,
  median_price DECIMAL,
  total_items INTEGER,
  scarcity_score DECIMAL,
  PRIMARY KEY (year, category)
);

-- User queries (for analytics)
CREATE TABLE IF NOT EXISTS user_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT,
  query_type VARCHAR(50),
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes for the most common lookups
CREATE INDEX IF NOT EXISTS idx_scraped_data_category_era ON scraped_data (category, era);
CREATE INDEX IF NOT EXISTS idx_scraped_data_era ON scraped_data (era);
CREATE INDEX IF NOT EXISTS idx_user_queries_created_at ON user_queries (created_at);
CREATE INDEX IF NOT EXISTS idx_heal_ledger_collector ON heal_ledger (collector_id);
