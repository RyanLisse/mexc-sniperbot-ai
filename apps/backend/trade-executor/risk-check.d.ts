/**
 * Risk check result
 */
export interface RiskCheckResult {
    approved: boolean;
    reason?: string;
}
/**
 * Trade parameters for risk validation
 */
export interface TradeParams {
    symbol: string;
    quoteQty: number;
}
/**
 * Apply risk checks before trade execution
 * Enforces User Story 2 guardrails:
 * - max_trade_usdt limit
 * - max_position_usdt limit
 * - auto_trade flag
 */
export declare function checkTradeRisk(params: TradeParams): Promise<RiskCheckResult>;
