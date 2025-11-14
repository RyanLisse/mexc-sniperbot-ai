-- TimescaleDB setup for time-series trade data
-- Run this migration after enabling TimescaleDB extension in Supabase

-- Enable TimescaleDB extension (requires superuser, run in Supabase SQL editor)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert trade_attempts table to hypertable
SELECT create_hypertable('trade_attempts', 'created_at', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trade_attempts_symbol_time ON trade_attempts (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_attempts_status_time ON trade_attempts (status, created_at DESC);

-- Create continuous aggregate for OHLCV data (1 minute buckets)
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1m
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 minute', created_at) AS bucket,
  symbol,
  first(executed_price, created_at) AS open,
  max(executed_price) AS high,
  min(executed_price) AS low,
  last(executed_price, created_at) AS close,
  sum(executed_quantity::numeric) AS volume
FROM trade_attempts
WHERE executed_price IS NOT NULL
GROUP BY bucket, symbol;

-- Add data retention policy (keep 90 days)
SELECT add_retention_policy('trade_attempts', INTERVAL '90 days', if_not_exists => TRUE);

