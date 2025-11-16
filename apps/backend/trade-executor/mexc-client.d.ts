/**
 * MEXC order side
 */
export type MEXCOrderSide = "BUY" | "SELL";
/**
 * MEXC order type
 */
export type MEXCOrderType = "MARKET" | "LIMIT";
/**
 * Market buy order request using quoteOrderQty (USDT amount)
 * Aligns with User Story 2 FR-006
 */
export interface MarketBuyOrderRequest {
    symbol: string;
    quoteOrderQty: number;
}
/**
 * MEXC order response
 */
export interface MEXCOrderResponse {
    orderId: string;
    symbol: string;
    status: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    price: string;
}
/**
 * Place a market buy order on MEXC using quoteOrderQty
 * T094: Market buy order with quoteOrderQty
 * T095: Order status polling
 * T096: Retry logic with exponential backoff
 * T097: Integration with executor
 */
export declare function placeMarketBuyOrder(request: MarketBuyOrderRequest): Promise<MEXCOrderResponse>;
/**
 * Validate MEXC API credentials on startup
 * T103: Secret validation
 */
export declare function validateMEXCCredentials(): Promise<boolean>;
export declare function ensureMEXCCredentialsValid(): Promise<void>;
