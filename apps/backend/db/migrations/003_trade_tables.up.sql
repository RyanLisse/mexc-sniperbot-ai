-- User Story 2: Trade configuration and execution tables

-- TradeConfig table: stores risk management configuration
CREATE TABLE trade_config (
  id BIGSERIAL PRIMARY KEY,
  max_trade_usdt NUMERIC(12,2) NOT NULL CHECK (max_trade_usdt > 0),
  max_position_usdt NUMERIC(12,2) NOT NULL CHECK (max_position_usdt >= max_trade_usdt),
  auto_trade BOOLEAN NOT NULL DEFAULT false,
  high_value_threshold_usdt NUMERIC(12,2) NOT NULL DEFAULT 500.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default configuration (auto_trade OFF by default for safety)
INSERT INTO trade_config (max_trade_usdt, max_position_usdt, auto_trade) 
VALUES (100.00, 1000.00, false);

-- Trades table: records all trade execution attempts and outcomes
CREATE TABLE trades (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quote_qty NUMERIC(12,2) NOT NULL CHECK (quote_qty > 0),
  base_qty NUMERIC(18,8),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'live')),
  status TEXT NOT NULL CHECK (status IN ('filled', 'rejected', 'failed', 'pending')),
  error_reason TEXT,
  exchange_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes for trades
CREATE INDEX idx_trades_created_at ON trades (created_at DESC);
CREATE INDEX idx_trades_symbol ON trades (symbol);
CREATE INDEX idx_trades_status ON trades (status);
CREATE INDEX idx_trades_mode ON trades (mode);

-- Comments for documentation
COMMENT ON TABLE trade_config IS 'Risk management configuration for automated trading';
COMMENT ON COLUMN trade_config.auto_trade IS 'Master switch: false = dry-run only, true = allow live trades';
COMMENT ON COLUMN trade_config.max_trade_usdt IS 'Maximum USDT amount per single trade';
COMMENT ON COLUMN trade_config.max_position_usdt IS 'Maximum total exposure across all open positions';
COMMENT ON COLUMN trade_config.high_value_threshold_usdt IS 'Trades above this require dashboard confirmation';

COMMENT ON TABLE trades IS 'Audit trail of all trade execution attempts (dry-run and live)';
COMMENT ON COLUMN trades.mode IS 'Execution mode: dry-run (simulated) or live (real exchange order)';
COMMENT ON COLUMN trades.status IS 'Outcome: filled (success), rejected (risk check failed), failed (exchange error), pending (in progress)';
COMMENT ON COLUMN trades.quote_qty IS 'Order size in quote currency (USDT)';
COMMENT ON COLUMN trades.base_qty IS 'Filled amount in base currency (NULL if rejected/dry-run)';
COMMENT ON COLUMN trades.latency_ms IS 'Execution latency from decision to exchange ACK or rejection';
