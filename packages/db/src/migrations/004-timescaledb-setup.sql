-- TimescaleDB setup for time-series trade data
-- OPTIONAL: This migration is for production optimization with Supabase/TimescaleDB
-- For test environments, standard PostgreSQL indexes are sufficient

-- Enable TimescaleDB extension (skip if not available)
DO $$ 
BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB extension not available, skipping hypertable setup';
END $$;

-- Create standard indexes for common queries (works without TimescaleDB)
CREATE INDEX IF NOT EXISTS idx_trade_attempts_symbol_time ON trade_attempts (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_attempts_status_time ON trade_attempts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_attempts_created_at ON trade_attempts (created_at DESC);

-- TimescaleDB-specific features (commented out for test environments)
-- NOTE: To use TimescaleDB hypertables, the primary key must include the partitioning column
-- In production, consider modifying the trade_attempts schema to use (id, created_at) composite PK

-- Convert trade_attempts table to hypertable (requires modified schema)
-- SELECT create_hypertable('trade_attempts', 'created_at', if_not_exists => TRUE);

-- Create continuous aggregate for OHLCV data (requires hypertable)
-- CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1m
-- WITH (timescaledb.continuous) AS
-- SELECT 
--   time_bucket('1 minute', created_at) AS bucket,
--   symbol,
--   first(executed_price, created_at) AS open,
--   max(executed_price) AS high,
--   min(executed_price) AS low,
--   last(executed_price, created_at) AS close,
--   sum(executed_quantity::numeric) AS volume
-- FROM trade_attempts
-- WHERE executed_price IS NOT NULL
-- GROUP BY bucket, symbol;

-- Add data retention policy (requires hypertable)
-- SELECT add_retention_policy('trade_attempts', INTERVAL '90 days', if_not_exists => TRUE);

