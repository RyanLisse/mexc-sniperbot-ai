/**
 * Response types matching API contracts
 */
export interface StartMonitorResponse {
    status: "running";
    startedAt: string;
    message: string;
}
export interface StopMonitorResponse {
    status: "stopped";
    stoppedAt: string;
    message: string;
}
export interface MonitorStatusResponse {
    status: "running" | "stopped" | "degraded";
    lastEventAt: string | null;
    uptime: number | null;
    listingsDetected: number;
    websocketConnected: boolean;
    lastError: string | null;
}
/**
 * POST /monitor/start
 * Start market monitoring (idempotent)
 */
export declare const start: (req: void) => Promise<StartMonitorResponse>;
/**
 * POST /monitor/stop
 * Stop market monitoring (idempotent)
 */
export declare const stop: (req: void) => Promise<StopMonitorResponse>;
/**
 * GET /monitor/status
 * Get current monitoring status
 */
export declare const status: (req: void) => Promise<MonitorStatusResponse>;
/**
 * Helper function to increment listings count
 * Called from listingDetector when new listing is detected
 */
export declare function incrementListingsDetected(): void;
