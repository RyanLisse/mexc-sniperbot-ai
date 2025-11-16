import log from "encore.dev/log";
import { BotDB } from "../db/db";
/**
 * In-memory cache for fast deduplication
 * Key format: "symbol:listedAt" (ISO timestamp)
 */
class ListingCache {
    cache = new Set();
    // Limit cache size to prevent memory bloat
    MAX_CACHE_SIZE = 10000;
    getCacheKey(symbol, listedAt) {
        return `${symbol}:${listedAt.toISOString()}`;
    }
    has(symbol, listedAt) {
        return this.cache.has(this.getCacheKey(symbol, listedAt));
    }
    add(symbol, listedAt) {
        const key = this.getCacheKey(symbol, listedAt);
        // Basic LRU: clear cache if too large
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            log.warn(`Listing cache size exceeded ${this.MAX_CACHE_SIZE}, clearing cache`);
            this.cache.clear();
        }
        this.cache.add(key);
    }
    size() {
        return this.cache.size;
    }
}
const listingCache = new ListingCache();
/**
 * Detect and record a new listing
 * Implements two-tier deduplication:
 * 1. In-memory cache (fast path)
 * 2. Database unique constraint (authoritative)
 */
export async function detectListing(listing) {
    const { symbol, listedAt, source } = listing;
    // Fast path: check in-memory cache
    if (listingCache.has(symbol, listedAt)) {
        log.info("Listing detected (cache hit - duplicate)", { symbol, source });
        return { duplicate: true };
    }
    try {
        // Insert into database with unique constraint
        const result = await BotDB.queryRow `
      INSERT INTO listings (symbol, listed_at, source)
      VALUES (${symbol}, ${listedAt}, ${source})
      RETURNING id
    `;
        if (!result) {
            log.error("Failed to insert listing (no result)", { symbol, source });
            return { duplicate: true };
        }
        // Add to cache after successful insert
        listingCache.add(symbol, listedAt);
        // Observability: Log as metric-style event for monitoring
        log.info("New listing detected", {
            metric: "listings_detected_total",
            listingId: result.id,
            symbol,
            source,
            listedAt: listedAt.toISOString(),
            cacheSize: listingCache.size(),
        });
        return {
            duplicate: false,
            listingId: result.id,
        };
    }
    catch (error) {
        // PostgreSQL unique constraint violation error code
        if (error?.code === "23505") {
            log.info("Listing detected (DB constraint - duplicate)", { symbol, source });
            // Add to cache to speed up future checks
            listingCache.add(symbol, listedAt);
            return { duplicate: true };
        }
        // Other errors
        log.error("Error detecting listing", { symbol, source, error });
        throw error;
    }
}
/**
 * Load existing listings into cache on startup
 * Speeds up deduplication for recently detected listings
 */
export async function initializeListingCache(limit = 1000) {
    try {
        const recentListings = await BotDB.queryAll `
      SELECT symbol, listed_at
      FROM listings
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
        recentListings.forEach((listing) => {
            listingCache.add(listing.symbol, listing.listed_at);
        });
        log.info(`Initialized listing cache with ${recentListings.length} recent listings`);
    }
    catch (error) {
        log.error("Failed to initialize listing cache", { error });
        // Non-fatal: continue without cache preload
    }
}
//# sourceMappingURL=listingDetector.js.map