import { type Query } from "encore.dev/api";
/**
 * Listing source enum matching database constraint
 */
export type ListingSource = "mexc_websocket" | "mexc_rest_api" | "test_injection";
/**
 * Listing entity matching database schema
 */
export type Listing = {
    id: number;
    symbol: string;
    listedAt: string;
    source: ListingSource;
    createdAt: string;
};
/**
 * Query parameters for GET /listings
 */
export type ListingsParams = {
    limit?: Query<number>;
    offset?: Query<number>;
    source?: Query<ListingSource>;
};
/**
 * Response for GET /listings
 */
export type ListingsResponse = {
    listings: Listing[];
    total: number;
    limit: number;
    offset: number;
};
/**
 * GET /listings
 * Retrieve recent listings with pagination and optional source filtering
 */
export declare const listings: (req: ListingsParams) => Promise<ListingsResponse>;
