export interface RiskMetrics {
    totalExposure: number;
    activePositions: number;
    winRate: number;
    avgLatency: number;
    failedTrades: number;
    totalTrades: number;
    dailyPnL: number;
}
export declare const getRiskMetrics: (req: void) => Promise<RiskMetrics>;
export interface ValidateTradeRequest {
    symbol: string;
    quantity: number;
    price: number;
}
export interface ValidateTradeResponse {
    approved: boolean;
    reason?: string;
    adjustedQuantity?: number;
}
export declare const validateTrade: (req: ValidateTradeRequest) => Promise<ValidateTradeResponse>;
