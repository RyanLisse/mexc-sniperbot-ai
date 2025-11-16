import { api } from "encore.dev/api";
import { BotDB } from "../db/db";

/**
 * Trade record from database (User Story 2 schema)
 */
export interface Trade {
  id: number;
  symbol: string;
  side: string;
  quoteQty: number;
  baseQty: number | null;
  latencyMs: number;
  mode: "dry-run" | "live";
  status: "filled" | "rejected" | "failed" | "pending";
  errorReason: string | null;
  exchangeOrderId: string | null;
  createdAt: Date;
}

/**
 * Query parameters for trade history
 */
export interface TradeHistoryRequest {
  limit?: number;
  offset?: number;
  mode?: "dry-run" | "live"; // Filter by execution mode
  status?: "filled" | "rejected" | "failed" | "pending"; // Filter by status
}

/**
 * Trade history response with pagination
 */
export interface TradeHistoryResponse {
  trades: Trade[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get trade history with pagination and filtering
 * User Story 2 FR-009: Audit trail endpoint
 */
export const getTradeHistory = api<TradeHistoryRequest, TradeHistoryResponse>(
  { method: "GET", path: "/trade/history", expose: true, auth: false },
  async (req) => {
    const limit = Math.min(req.limit || 50, 200); // Cap at 200
    const offset = req.offset || 0;

    // Build WHERE clause for filters
    const filters: string[] = [];
    const params: any[] = [];

    if (req.mode) {
      params.push(req.mode);
      filters.push(`mode = $${params.length}`);
    }

    if (req.status) {
      params.push(req.status);
      filters.push(`status = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    // Query trades
    const sql = `
      SELECT id, symbol, side, quote_qty as "quoteQty", base_qty as "baseQty",
             latency_ms as "latencyMs", mode, status, error_reason as "errorReason",
             exchange_order_id as "exchangeOrderId", created_at as "createdAt"
      FROM trades
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const trades = await BotDB.rawQueryAll<Trade>(sql, ...params);

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM trades ${whereClause}`;
    const countResult = await BotDB.rawQueryAll<{ count: string }>(
      countSql,
      ...params.slice(0, filters.length)
    );

    return {
      trades,
      total: parseInt(countResult[0]?.count || "0", 10),
      limit,
      offset,
    };
  }
);
