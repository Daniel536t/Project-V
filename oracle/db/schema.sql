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

-- Watches (SENSE: an agent keeps an eye on a URL and alerts on change)
CREATE TABLE IF NOT EXISTS watches (
  id TEXT PRIMARY KEY,
  label TEXT,
  url TEXT NOT NULL,
  intent TEXT,
  field TEXT NOT NULL DEFAULT 'price',
  operator TEXT NOT NULL DEFAULT '<',
  target TEXT,
  status TEXT NOT NULL DEFAULT 'watching',
  last_value TEXT,
  selector TEXT,
  scar_count INTEGER NOT NULL DEFAULT 0,
  query TEXT,
  last_checked_at TIMESTAMP,
  next_check_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SENSE watches (extended for the split-screen product)
ALTER TABLE watches ADD COLUMN IF NOT EXISTS collector_id TEXT;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'store';

-- Store (the controllable e-commerce page SENSE watches)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  template TEXT NOT NULL DEFAULT 'A',
  bot_detection BOOLEAN NOT NULL DEFAULT false,
  stock_level INTEGER NOT NULL DEFAULT 3
);

INSERT INTO products (id, name, price, in_stock, template, bot_detection, stock_level)
VALUES ('iphone-17-pro', 'iPhone 17 Pro', 999, true, 'A', false, 3)
ON CONFLICT (id) DO NOTHING;

-- Scrape history (one row per real scrape per watch)
CREATE TABLE IF NOT EXISTS scrape_history (
  id SERIAL PRIMARY KEY,
  watch_id TEXT,
  price NUMERIC,
  in_stock BOOLEAN,
  raw JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Heal ledger: structured scar rows (the immune-system log)
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS watch_id TEXT;
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS original_intent TEXT;
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS old_selector TEXT;
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS new_selector TEXT;
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS confidence INTEGER;
ALTER TABLE heal_ledger ADD COLUMN IF NOT EXISTS recovery_seconds INTEGER;

-- Helpful indexes for the most common lookups
CREATE INDEX IF NOT EXISTS idx_scraped_data_category_era ON scraped_data (category, era);
CREATE INDEX IF NOT EXISTS idx_scraped_data_era ON scraped_data (era);
CREATE INDEX IF NOT EXISTS idx_user_queries_created_at ON user_queries (created_at);
CREATE INDEX IF NOT EXISTS idx_heal_ledger_collector ON heal_ledger (collector_id);
CREATE INDEX IF NOT EXISTS idx_heal_ledger_watch ON heal_ledger (watch_id);
CREATE INDEX IF NOT EXISTS idx_scrape_history_watch ON scrape_history (watch_id);
