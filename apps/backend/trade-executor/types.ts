/**
 * Trade request using quote-based ordering (USDT amount)
 * Aligns with User Story 2 FR-006: MARKET BUY using quoteOrderQty
 */
export interface TradeRequest {
  symbol: string;
  side: "buy" | "sell";
  quoteQty: number; // USDT amount
}

/**
 * Trade response matching User Story 2 spec
 * Status: filled (success), rejected (risk check), failed (exchange error), pending
 * Mode: dry-run (simulated) or live (real exchange)
 */
export interface TradeResponse {
  tradeId: number;
  orderId?: string;
  status: "filled" | "rejected" | "failed" | "pending";
  mode: "dry-run" | "live";
  baseQty?: number; // Filled amount in base currency
  latencyMs: number;
  errorReason?: string;
}

export interface MEXCOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
  timestamp: number;
  signature: string;
}

export interface MEXCOrderResponse {
  orderId: string;
  symbol: string;
  status: string;
  executedQty: string;
  price: string;
}
