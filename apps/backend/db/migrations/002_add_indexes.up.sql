-- Performance optimization: Composite index for source-specific queries
CREATE INDEX idx_listings_source_created ON listings (source, created_at DESC);

COMMENT ON INDEX idx_listings_source_created IS 'Speeds up queries filtered by source and sorted by creation time';
