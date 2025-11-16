class Metric {
    name;
    options;
    constructor(name, options) {
        this.name = name;
        this.options = options;
    }
    add(_value, _labels) { }
    set(_value, _labels) { }
}
/**
 * Metrics for trade execution monitoring
 * User Story 2 T146-T150: Observability instrumentation
 */
/**
 * T146: Counter for total trades executed
 */
export const tradesExecutedTotal = new Metric("trades_executed_total", {
    type: "counter",
    description: "Total number of trades executed by mode and status",
});
/**
 * T147: Histogram for trade execution latency
 */
export const tradeExecutionLatency = new Metric("trade_execution_latency_ms", {
    type: "histogram",
    description: "Trade execution latency from decision to exchange ACK in milliseconds",
});
/**
 * T148: Counter for risk check rejections
 */
export const riskCheckRejections = new Metric("risk_check_rejections_total", {
    type: "counter",
    description: "Total number of trades rejected by risk checks",
});
/**
 * T149: Gauge for current auto-trade mode
 */
export const autoTradeModeEnabled = new Metric("auto_trade_mode_enabled", {
    type: "gauge",
    description: "Auto-trade mode status (1 = enabled, 0 = disabled)",
});
/**
 * T149: Counter for configuration updates
 */
export const configUpdatesTotal = new Metric("config_updates_total", {
    type: "counter",
    description: "Total number of trade configuration updates",
});
/**
 * T150: Counter for MEXC API errors
 */
export const mexcApiErrors = new Metric("mexc_api_errors_total", {
    type: "counter",
    description: "Total number of MEXC API errors by error type",
});
/**
 * Helper function to record trade execution
 */
export function recordTradeExecution(mode, status, latencyMs) {
    tradesExecutedTotal.add(1, { mode, status });
    tradeExecutionLatency.add(latencyMs, { mode });
}
/**
 * Helper function to record risk check rejection
 */
export function recordRiskRejection(reason) {
    riskCheckRejections.add(1, { reason });
}
/**
 * Helper function to update auto-trade mode status
 */
export function recordAutoTradeMode(enabled) {
    autoTradeModeEnabled.set(enabled ? 1 : 0, {});
}
/**
 * Helper function to record MEXC API error
 */
export function recordMEXCError(errorType) {
    mexcApiErrors.add(1, { error_type: errorType });
}
/**
 * Helper function to record configuration updates
 */
export function recordConfigUpdate() {
    configUpdatesTotal.add(1, {});
}
//# sourceMappingURL=trade-metrics.js.map