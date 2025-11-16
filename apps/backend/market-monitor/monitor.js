import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { MEXCWebSocketClient } from "./mexcWebSocket";
import { BotDB } from "../db/db";
// Singleton WebSocket client instance
let wsClient = null;
let monitorStartedAt = null;
let listingsDetectedCount = 0;
let lastListingDetectedAt = null;
/**
 * POST /monitor/start
 * Start market monitoring (idempotent)
 */
export const start = api({ method: "POST", path: "/monitor/start", expose: true }, async () => {
    // If already running, return success (idempotent)
    if (wsClient && wsClient.isConnected()) {
        log.info("Monitor start requested but already running");
        return {
            status: "running",
            startedAt: monitorStartedAt?.toISOString() || new Date().toISOString(),
            message: "Market monitor already running",
        };
    }
    try {
        // Create new WebSocket client
        wsClient = new MEXCWebSocketClient();
        await wsClient.initialize();
        monitorStartedAt = new Date();
        listingsDetectedCount = 0;
        log.info("Market monitor started successfully", {
            startedAt: monitorStartedAt.toISOString(),
        });
        return {
            status: "running",
            startedAt: monitorStartedAt.toISOString(),
            message: "Market monitor started successfully",
        };
    }
    catch (error) {
        log.error("Failed to start market monitor", { error: error.message });
        // Clean up failed client
        if (wsClient) {
            await wsClient.shutdown();
            wsClient = null;
        }
        throw new Error(`Failed to start monitoring: ${error.message}`);
    }
});
/**
 * POST /monitor/stop
 * Stop market monitoring (idempotent)
 */
export const stop = api({ method: "POST", path: "/monitor/stop", expose: true }, async () => {
    const stoppedAt = new Date();
    // If not running, return success (idempotent)
    if (!wsClient) {
        log.info("Monitor stop requested but not running");
        return {
            status: "stopped",
            stoppedAt: stoppedAt.toISOString(),
            message: "Market monitor not running",
        };
    }
    try {
        await wsClient.shutdown();
        wsClient = null;
        monitorStartedAt = null;
        log.info("Market monitor stopped successfully", {
            stoppedAt: stoppedAt.toISOString(),
        });
        return {
            status: "stopped",
            stoppedAt: stoppedAt.toISOString(),
            message: "Market monitor stopped successfully",
        };
    }
    catch (error) {
        log.error("Error stopping market monitor", { error: error.message });
        // Force cleanup even on error
        wsClient = null;
        monitorStartedAt = null;
        return {
            status: "stopped",
            stoppedAt: stoppedAt.toISOString(),
            message: "Market monitor stopped with errors",
        };
    }
});
/**
 * GET /monitor/status
 * Get current monitoring status
 */
export const status = api({ method: "GET", path: "/monitor/status", expose: true }, async () => {
    const isRunning = wsClient !== null;
    const isConnected = wsClient?.isConnected() || false;
    // Calculate uptime
    let uptime = null;
    if (isRunning && monitorStartedAt) {
        uptime = Math.floor((Date.now() - monitorStartedAt.getTime()) / 1000);
    }
    // Determine status
    let overallStatus;
    if (!isRunning) {
        overallStatus = "stopped";
    }
    else if (isConnected) {
        overallStatus = "running";
    }
    else {
        overallStatus = "degraded";
    }
    // Get total listings count from database
    const result = await BotDB.queryRow `
      SELECT COUNT(*)::int as count FROM listings
    `;
    const totalListings = result?.count || 0;
    return {
        status: overallStatus,
        lastEventAt: lastListingDetectedAt?.toISOString() || null,
        uptime,
        listingsDetected: totalListings,
        websocketConnected: isConnected,
        lastError: null, // TODO: Track last error
    };
});
/**
 * Helper function to increment listings count
 * Called from listingDetector when new listing is detected
 */
export function incrementListingsDetected() {
    listingsDetectedCount++;
    lastListingDetectedAt = new Date();
}
//# sourceMappingURL=monitor.js.map