import { api, type Query } from "encore.dev/api";
import log from "encore.dev/log";
import { BotDB } from "../db/db";

/**
 * Listing source enum matching database constraint
 */
export type ListingSource =
  | "mexc_websocket"
  | "mexc_rest_api"
  | "test_injection";

/**
 * Listing entity matching database schema
 */
export type Listing = {
  id: number;
  symbol: string;
  listedAt: string; // ISO 8601
  source: ListingSource;
  createdAt: string; // ISO 8601
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

type DbListingRow = {
  id: number;
  symbol: string;
  listed_at: Date;
  source: string;
  created_at: Date;
};

/**
 * GET /listings
 * Retrieve recent listings with pagination and optional source filtering
 */
export const listings = api<ListingsParams, ListingsResponse>(
  { method: "GET", path: "/listings", expose: true },
  async (params: ListingsParams) => {
    const startTime = performance.now();

    // Validate and set defaults
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const source = params.source;

    try {
      // Build query with optional source filter
      let query: Promise<DbListingRow[]>;
      let countQuery: Promise<{ count: number }>;

      if (source) {
        query = BotDB.queryAll<DbListingRow>`
          SELECT id, symbol, listed_at, source, created_at
          FROM listings
          WHERE source = ${source}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        countQuery = BotDB.queryRow<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM listings
          WHERE source = ${source}
        `;
      } else {
        query = BotDB.queryAll<{
          id: number;
          symbol: string;
          listed_at: Date;
          source: string;
          created_at: Date;
        }>`
          SELECT id, symbol, listed_at, source, created_at
          FROM listings
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        countQuery = BotDB.queryRow<{ count: number }>`
          SELECT COUNT(*)::int as count FROM listings
        `;
      }

      const [rows, countResult] = await Promise.all([query, countQuery]);

      const latency = performance.now() - startTime;

      // Observability: Log query latency as histogram metric
      log.info("Listings query executed", {
        metric: "api_request_duration_seconds",
        latencyMs: Math.round(latency),
        latencySeconds: (latency / 1000).toFixed(3),
        endpoint: "/listings",
        limit,
        offset,
        source,
        resultCount: rows.length,
      });

      // Convert to API response format
      const mappedListings: Listing[] = rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        listedAt: row.listed_at.toISOString(),
        source: row.source as ListingSource,
        createdAt: row.created_at.toISOString(),
      }));

      return {
        listings: mappedListings,
        total: countResult?.count || 0,
        limit,
        offset,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Error fetching listings", { error: message });
      throw error;
    }
  }
);
