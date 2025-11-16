-- Listings table: tracks new token listings detected from MEXC
CREATE TABLE listings (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  listed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mexc_websocket', 'mexc_rest_api', 'test_injection')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_listing UNIQUE (symbol, listed_at)
);

-- Index for recent listings queries (dashboard use case)
CREATE INDEX idx_listings_created_at ON listings (created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE listings IS 'Tracks new token listings detected from MEXC';
COMMENT ON COLUMN listings.source IS 'Detection source: mexc_websocket | mexc_rest_api | test_injection';
COMMENT ON COLUMN listings.listed_at IS 'Timestamp when MEXC announced/listed the token';
COMMENT ON COLUMN listings.created_at IS 'Timestamp when this row was inserted into our database';
