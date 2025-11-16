declare class Metric<TLabels extends Record<string, any> | {}> {
    name: string;
    options: {
        type: "counter" | "histogram" | "gauge";
        description: string;
    };
    constructor(name: string, options: {
        type: "counter" | "histogram" | "gauge";
        description: string;
    });
    add(_value: number, _labels: TLabels): void;
    set(_value: number, _labels: TLabels): void;
}
/**
 * Metrics for trade execution monitoring
 * User Story 2 T146-T150: Observability instrumentation
 */
/**
 * T146: Counter for total trades executed
 */
export declare const tradesExecutedTotal: Metric<{
    mode: string;
    status: string;
}>;
/**
 * T147: Histogram for trade execution latency
 */
export declare const tradeExecutionLatency: Metric<{
    mode: string;
}>;
/**
 * T148: Counter for risk check rejections
 */
export declare const riskCheckRejections: Metric<{
    reason: string;
}>;
/**
 * T149: Gauge for current auto-trade mode
 */
export declare const autoTradeModeEnabled: Metric<{}>;
/**
 * T149: Counter for configuration updates
 */
export declare const configUpdatesTotal: Metric<{}>;
/**
 * T150: Counter for MEXC API errors
 */
export declare const mexcApiErrors: Metric<{
    error_type: string;
}>;
/**
 * Helper function to record trade execution
 */
export declare function recordTradeExecution(mode: "dry-run" | "live", status: string, latencyMs: number): void;
/**
 * Helper function to record risk check rejection
 */
export declare function recordRiskRejection(reason: string): void;
/**
 * Helper function to update auto-trade mode status
 */
export declare function recordAutoTradeMode(enabled: boolean): void;
/**
 * Helper function to record MEXC API error
 */
export declare function recordMEXCError(errorType: string): void;
/**
 * Helper function to record configuration updates
 */
export declare function recordConfigUpdate(): void;
export {};
