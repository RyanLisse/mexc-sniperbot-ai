CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_price DOUBLE PRECISION,
  listing_source TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_detected_at ON listings(detected_at DESC);
CREATE INDEX idx_listings_symbol ON listings(symbol);

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  total_value DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  order_id TEXT,
  executed_at TIMESTAMPTZ,
  latency_ms BIGINT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_listing_id ON trades(listing_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_status ON trades(status);

CREATE TABLE IF NOT EXISTS market_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  bid_price DOUBLE PRECISION,
  ask_price DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);

CREATE TABLE IF NOT EXISTS bot_health (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms BIGINT,
  error_count BIGINT DEFAULT 0,
  last_error TEXT,
  metadata JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bot_health_service_checked ON bot_health(service_name, checked_at DESC);

CREATE TABLE IF NOT EXISTS trade_config (
  id BIGSERIAL PRIMARY KEY,
  max_position_size DOUBLE PRECISION NOT NULL DEFAULT 100,
  max_trade_amount DOUBLE PRECISION NOT NULL DEFAULT 50,
  risk_per_trade DOUBLE PRECISION NOT NULL DEFAULT 0.02,
  stop_loss_pct DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  take_profit_pct DOUBLE PRECISION NOT NULL DEFAULT 0.10,
  max_slippage_pct DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO trade_config (id) VALUES (1) ON CONFLICT DO NOTHING;
