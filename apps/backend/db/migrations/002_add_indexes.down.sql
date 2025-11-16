-- Rollback: Remove performance indexes
DROP INDEX IF EXISTS idx_listings_source_created;
