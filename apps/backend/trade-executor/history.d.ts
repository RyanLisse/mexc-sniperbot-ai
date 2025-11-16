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
    mode?: "dry-run" | "live";
    status?: "filled" | "rejected" | "failed" | "pending";
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
export declare const getTradeHistory: (req: TradeHistoryRequest) => Promise<TradeHistoryResponse>;
