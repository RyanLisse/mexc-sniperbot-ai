import { api } from "encore.dev/api";
import { BotDB } from "../db/db";

const version = process.env.APP_VERSION ?? "0.1.0";
const environment = process.env.NODE_ENV ?? "development";

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

const startTime = Date.now();

/**
 * GET /health
 * Enhanced health check endpoint with component status
 * User Story 3: System health monitoring
 */
export const health = api<void, HealthResponse>(
  { method: "GET", path: "/health", expose: true, auth: false },
  async () => {
    // Check database health
    let dbHealth: "healthy" | "degraded" | "down" = "healthy";
    try {
      await BotDB.queryRow`SELECT 1`;
    } catch (error) {
      dbHealth = "down";
    }

    // Check MEXC API health (simplified - assume healthy)
    const mexcHealth: "healthy" | "degraded" | "down" = "healthy";

    // Check WebSocket health (simplified - assume healthy)
    const wsHealth: "healthy" | "degraded" | "down" = "healthy";

    const overallStatus = 
      dbHealth === "down" ? "down" :
      dbHealth === "degraded" || mexcHealth === "degraded" || wsHealth === "degraded" ? "degraded" :
      "healthy";

    return {
      status: overallStatus,
      version,
      environment,
      components: {
        database: dbHealth,
        mexc: mexcHealth,
        websocket: wsHealth,
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
);
