export interface PerformanceMetrics {
    avgExecutionLatency: number;
    p95ExecutionLatency: number;
    p99ExecutionLatency: number;
    successRate: number;
    tradesPerHour: number;
    listingsPerHour: number;
}
export declare const getPerformanceMetrics: (req: void) => Promise<PerformanceMetrics>;
