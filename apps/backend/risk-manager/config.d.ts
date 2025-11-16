/**
 * Trade configuration matching User Story 2 spec
 */
export interface TradingConfig {
    maxTradeUsdt: number;
    maxPositionUsdt: number;
    autoTrade: boolean;
    highValueThresholdUsdt: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const getConfig: (req: void) => Promise<TradingConfig>;
/**
 * Update configuration request
 * All fields optional - only provided fields are updated
 */
export interface UpdateConfigRequest {
    maxTradeUsdt?: number;
    maxPositionUsdt?: number;
    autoTrade?: boolean;
    highValueThresholdUsdt?: number;
}
export declare const updateConfig: (req: UpdateConfigRequest) => Promise<TradingConfig>;
