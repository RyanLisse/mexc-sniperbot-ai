/**
 * Source of listing detection
 */
export type ListingSource = "mexc_websocket" | "mexc_rest_api" | "test_injection";
/**
 * Detected listing data
 */
export interface DetectedListing {
    symbol: string;
    listedAt: Date;
    source: ListingSource;
}
/**
 * Result of listing detection
 */
export interface DetectionResult {
    duplicate: boolean;
    listingId?: number;
}
/**
 * Detect and record a new listing
 * Implements two-tier deduplication:
 * 1. In-memory cache (fast path)
 * 2. Database unique constraint (authoritative)
 */
export declare function detectListing(listing: DetectedListing): Promise<DetectionResult>;
/**
 * Load existing listings into cache on startup
 * Speeds up deduplication for recently detected listings
 */
export declare function initializeListingCache(limit?: number): Promise<void>;
