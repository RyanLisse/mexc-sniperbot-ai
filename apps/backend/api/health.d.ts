/**
 * Health response matching API contract
 */
interface HealthResponse {
    status: string;
    version: string;
    environment: string;
    components: {
        database: "healthy" | "degraded" | "down";
        mexc: "healthy" | "degraded" | "down";
        websocket: "healthy" | "degraded" | "down";
    };
    uptime: number;
    timestamp: string;
}
/**
 * GET /health
 * Enhanced health check endpoint with component status
 * User Story 3: System health monitoring
 */
export declare const health: (req: void) => Promise<HealthResponse>;
export {};
