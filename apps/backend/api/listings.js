import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { BotDB } from "../db/db";
/**
 * GET /listings
 * Retrieve recent listings with pagination and optional source filtering
 */
export const listings = api({ method: "GET", path: "/listings", expose: true }, async (params) => {
    const startTime = performance.now();
    // Validate and set defaults
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const source = params.source;
    try {
        // Build query with optional source filter
        let query;
        let countQuery;
        if (source) {
            query = BotDB.queryAll `
          SELECT id, symbol, listed_at, source, created_at
          FROM listings
          WHERE source = ${source}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
            countQuery = BotDB.queryRow `
          SELECT COUNT(*)::int as count
          FROM listings
          WHERE source = ${source}
        `;
        }
        else {
            query = BotDB.queryAll `
          SELECT id, symbol, listed_at, source, created_at
          FROM listings
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
            countQuery = BotDB.queryRow `
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
        const mappedListings = rows.map((row) => ({
            id: row.id,
            symbol: row.symbol,
            listedAt: row.listed_at.toISOString(),
            source: row.source,
            createdAt: row.created_at.toISOString(),
        }));
        return {
            listings: mappedListings,
            total: countResult?.count || 0,
            limit,
            offset,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("Error fetching listings", { error: message });
        throw error;
    }
});
//# sourceMappingURL=listings.js.map