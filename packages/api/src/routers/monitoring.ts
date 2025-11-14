import {
  botStatus,
  db,
  listingEvent,
  tradeAttempt,
} from "@mexc-sniperbot-ai/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { Effect } from "effect";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { MonitoringError, TradingLogger } from "../lib/effect";
import { mexcClient } from "../services/mexc-client";
import { tradingOrchestrator } from "../services/trading-orchestrator";

// Zod schemas for validation
const healthCheckSchema = z.object({
  detailed: z.boolean().default(false),
});

const performanceMetricsSchema = z.object({
  timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]).default("24h"),
  includeDetails: z.boolean().default(false),
});

const alertQuerySchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "resolved", "acknowledged"]).optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().nonnegative().default(0),
});

const systemStatusSchema = z.object({
  includeApiStatus: z.boolean().default(true),
  includeDatabaseStatus: z.boolean().default(true),
  includeBotStatus: z.boolean().default(true),
});

// Monitoring router
export const monitoringRouter = router({
  // Health check endpoint
  healthCheck: publicProcedure
    .input(healthCheckSchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Health check requested", {
            detailed: input.detailed,
          });

          const startTime = Date.now();
          const health: {
            status: "healthy" | "degraded" | "unhealthy";
            timestamp: string;
            uptime: number;
            checks: Record<
              string,
              {
                status: "pass" | "fail" | "warn";
                message?: string;
                responseTime?: number;
              }
            >;
          } = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime() * 1000, // Convert to milliseconds
            checks: {},
          };

          // Check bot status
          try {
            const botStatus = yield* tradingOrchestrator.getBotStatus();
            health.checks.bot = {
              status: botStatus.isRunning ? "pass" : "fail",
              message: botStatus.isRunning
                ? "Bot is running"
                : "Bot is stopped",
              responseTime: botStatus.apiResponseTime,
            };
          } catch (error) {
            health.checks.bot = {
              status: "fail",
              message:
                error instanceof Error ? error.message : "Unknown bot error",
            };
            health.status = "degraded";
          }

          // Check API connectivity
          if (input.detailed) {
            try {
              const apiStartTime = Date.now();
              yield* mexcClient.getServerTime();
              const apiResponseTime = Date.now() - apiStartTime;

              health.checks.mexcApi = {
                status: apiResponseTime < 5000 ? "pass" : "warn",
                message: `API responded in ${apiResponseTime}ms`,
                responseTime: apiResponseTime,
              };
            } catch (error) {
              health.checks.mexcApi = {
                status: "fail",
                message:
                  error instanceof Error
                    ? error.message
                    : "API connectivity failed",
              };
              health.status = "unhealthy";
            }
          }

          // Check database connectivity
          if (input.detailed) {
            try {
              const dbStartTime = Date.now();
              yield* Effect.tryPromise({
                try: () => db.select().from(botStatus).limit(1),
                catch: (error) => {
                  throw new MonitoringError({
                    message: `Database health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    component: "database",
                    timestamp: new Date(),
                  });
                },
              });
              const dbResponseTime = Date.now() - dbStartTime;

              health.checks.database = {
                status: dbResponseTime < 1000 ? "pass" : "warn",
                message: `Database responded in ${dbResponseTime}ms`,
                responseTime: dbResponseTime,
              };
            } catch (error) {
              health.checks.database = {
                status: "fail",
                message:
                  error instanceof Error
                    ? error.message
                    : "Database connectivity failed",
              };
              health.status = "unhealthy";
            }
          }

          // Determine overall health status
          const failedChecks = Object.values(health.checks).filter(
            (check) => check.status === "fail"
          );
          const warnChecks = Object.values(health.checks).filter(
            (check) => check.status === "warn"
          );

          if (failedChecks.length > 0) {
            health.status = "unhealthy";
          } else if (warnChecks.length > 0) {
            health.status = "degraded";
          }

          const totalResponseTime = Date.now() - startTime;

          yield* TradingLogger.logInfo("Health check completed", {
            status: health.status,
            responseTime: totalResponseTime,
            checksCount: Object.keys(health.checks).length,
          });

          return {
            ...health,
            responseTime: totalResponseTime,
          };
        })
      );
    }),

  // Get performance metrics
  getPerformanceMetrics: publicProcedure
    .input(performanceMetricsSchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching performance metrics", input);

          const now = new Date();
          const timeRangeMs = getTimeRangeMs(input.timeRange);
          const since = new Date(now.getTime() - timeRangeMs);

          try {
            // Get trade metrics
            const trades = yield* Effect.tryPromise({
              try: () =>
                db
                  .select()
                  .from(tradeAttempt)
                  .where(gt(tradeAttempt.createdAt, since))
                  .orderBy(desc(tradeAttempt.createdAt)),
              catch: (error) => {
                throw new MonitoringError({
                  message: `Failed to fetch trade metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
                  component: "database",
                  timestamp: new Date(),
                });
              },
            });

            const successfulTrades = trades.filter(
              (t) => t.status === "SUCCESS"
            );
            const failedTrades = trades.filter((t) => t.status === "FAILED");

            // Calculate performance metrics
            const tradeMetrics = {
              total: trades.length,
              successful: successfulTrades.length,
              failed: failedTrades.length,
              successRate:
                trades.length > 0
                  ? (successfulTrades.length / trades.length) * 100
                  : 0,
              averageExecutionTime:
                trades.length > 0
                  ? trades.reduce(
                      (sum, t) => sum + (t.executionTimeMs || 0),
                      0
                    ) / trades.length
                  : 0,
              fastestExecution:
                trades.length > 0
                  ? Math.min(...trades.map((t) => t.executionTimeMs || 0))
                  : 0,
              slowestExecution:
                trades.length > 0
                  ? Math.max(...trades.map((t) => t.executionTimeMs || 0))
                  : 0,
            };

            // Get listing metrics
            const listings = yield* Effect.tryPromise({
              try: () =>
                db
                  .select()
                  .from(listingEvent)
                  .where(
                    and(
                      gt(listingEvent.detectedAt, since),
                      eq(listingEvent.eventType, "NEW_LISTING_DETECTED")
                    )
                  )
                  .orderBy(desc(listingEvent.detectedAt)),
              catch: (error) => {
                throw new MonitoringError({
                  message: `Failed to fetch listing metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
                  component: "database",
                  timestamp: new Date(),
                });
              },
            });

            const listingMetrics = {
              total: listings.length,
              averagePrice:
                listings.length > 0
                  ? listings.reduce(
                      (sum, l) => sum + Number.parseFloat(l.price || "0"),
                      0
                    ) / listings.length
                  : 0,
              mostRecent: listings.length > 0 ? listings[0].detectedAt : null,
              oldest: listings.length > 0 ? listings.at(-1).detectedAt : null,
            };

            // Get bot status metrics
            const botStatuses = yield* Effect.tryPromise({
              try: () =>
                db
                  .select()
                  .from(botStatus)
                  .where(gt(botStatus.lastHeartbeat, since))
                  .orderBy(desc(botStatus.lastHeartbeat)),
              catch: (error) => {
                throw new MonitoringError({
                  message: `Failed to fetch bot status metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
                  component: "database",
                  timestamp: new Date(),
                });
              },
            });

            const botMetrics = {
              uptimePercentage:
                botStatuses.length > 0
                  ? (botStatuses.filter((status) => status.isRunning).length /
                      botStatuses.length) *
                    100
                  : 0,
              averageApiResponseTime:
                botStatuses.length > 0
                  ? botStatuses.reduce(
                      (sum, status) => sum + status.apiResponseTime,
                      0
                    ) / botStatuses.length
                  : 0,
              lastHeartbeat:
                botStatuses.length > 0 ? botStatuses[0].lastHeartbeat : null,
            };

            const metrics = {
              timeRange: input.timeRange,
              period: {
                start: since.toISOString(),
                end: now.toISOString(),
              },
              trades: tradeMetrics,
              listings: listingMetrics,
              bot: botMetrics,
              timestamp: now.toISOString(),
            };

            // Include detailed data if requested
            if (input.includeDetails) {
              (metrics as any).details = {
                recentTrades: trades.slice(0, 10),
                recentListings: listings.slice(0, 10),
                recentBotStatuses: botStatuses.slice(0, 10),
              };
            }

            yield* TradingLogger.logInfo(
              "Performance metrics fetched successfully",
              {
                timeRange: input.timeRange,
                tradeCount: tradeMetrics.total,
                listingCount: listingMetrics.total,
              }
            );

            return metrics;
          } catch (error) {
            if (error instanceof MonitoringError) {
              throw error;
            }

            throw new MonitoringError({
              message: `Failed to fetch performance metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
              component: "monitoring",
              timestamp: new Date(),
            });
          }
        })
      );
    }),

  // Get system status
  getSystemStatus: publicProcedure
    .input(systemStatusSchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching system status", input);

          const status: {
            overall: "operational" | "degraded" | "down";
            components: Record<
              string,
              {
                status: "operational" | "degraded" | "down";
                message?: string;
                lastChecked: string;
              }
            >;
            timestamp: string;
          } = {
            overall: "operational",
            components: {},
            timestamp: new Date().toISOString(),
          };

          // Check bot component
          if (input.includeBotStatus) {
            try {
              const botStatus = yield* tradingOrchestrator.getBotStatus();
              status.components.bot = {
                status: botStatus.isRunning ? "operational" : "down",
                message: botStatus.isRunning
                  ? "Bot is running"
                  : "Bot is stopped",
                lastChecked: new Date().toISOString(),
              };
            } catch (error) {
              status.components.bot = {
                status: "down",
                message:
                  error instanceof Error ? error.message : "Bot status unknown",
                lastChecked: new Date().toISOString(),
              };
            }
          }

          // Check API component
          if (input.includeApiStatus) {
            try {
              yield* mexcClient.getServerTime();
              status.components.mexcApi = {
                status: "operational",
                message: "API is responding",
                lastChecked: new Date().toISOString(),
              };
            } catch (error) {
              status.components.mexcApi = {
                status: "down",
                message:
                  error instanceof Error
                    ? error.message
                    : "API connectivity failed",
                lastChecked: new Date().toISOString(),
              };
            }
          }

          // Check database component
          if (input.includeDatabaseStatus) {
            try {
              yield* Effect.tryPromise({
                try: () => db.select().from(botStatus).limit(1),
                catch: (error) => {
                  throw new MonitoringError({
                    message: `Database status check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    component: "database",
                    timestamp: new Date(),
                  });
                },
              });
              status.components.database = {
                status: "operational",
                message: "Database is responding",
                lastChecked: new Date().toISOString(),
              };
            } catch (error) {
              status.components.database = {
                status: "down",
                message:
                  error instanceof Error
                    ? error.message
                    : "Database connectivity failed",
                lastChecked: new Date().toISOString(),
              };
            }
          }

          // Determine overall status
          const downComponents = Object.values(status.components).filter(
            (comp) => comp.status === "down"
          );
          const degradedComponents = Object.values(status.components).filter(
            (comp) => comp.status === "degraded"
          );

          if (downComponents.length > 0) {
            status.overall = "down";
          } else if (degradedComponents.length > 0) {
            status.overall = "degraded";
          }

          yield* TradingLogger.logInfo("System status fetched successfully", {
            overall: status.overall,
            componentsCount: Object.keys(status.components).length,
          });

          return status;
        })
      );
    }),

  // Get recent alerts (placeholder for future alert system)
  getRecentAlerts: publicProcedure
    .input(alertQuerySchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching recent alerts", input);

          // Placeholder implementation - in a real system, you'd query an alerts table
          const alerts = [
            {
              id: "alert_1",
              type: "performance",
              severity: "medium",
              message: "Trade execution time exceeded threshold",
              component: "trade-executor",
              status: "resolved" as const,
              createdAt: new Date(Date.now() - 30_000).toISOString(),
              resolvedAt: new Date(Date.now() - 15_000).toISOString(),
            },
            {
              id: "alert_2",
              type: "connectivity",
              severity: "high",
              message: "MEXC API response time degraded",
              component: "mexc-api",
              status: "active" as const,
              createdAt: new Date(Date.now() - 10_000).toISOString(),
              resolvedAt: null,
            },
          ];

          // Apply filters
          let filteredAlerts = alerts;

          if (input.severity) {
            filteredAlerts = filteredAlerts.filter(
              (alert) => alert.severity === input.severity
            );
          }

          if (input.status) {
            filteredAlerts = filteredAlerts.filter(
              (alert) => alert.status === input.status
            );
          }

          // Apply pagination
          const startIndex = input.offset;
          const endIndex = startIndex + input.limit;
          const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

          yield* TradingLogger.logInfo("Recent alerts fetched successfully", {
            total: filteredAlerts.length,
            returned: paginatedAlerts.length,
            filters: {
              severity: input.severity,
              status: input.status,
            },
          });

          return {
            alerts: paginatedAlerts,
            total: filteredAlerts.length,
            pagination: {
              limit: input.limit,
              offset: input.offset,
              hasMore: endIndex < filteredAlerts.length,
            },
            timestamp: new Date().toISOString(),
          };
        })
      );
    }),

  // Get logs (placeholder for future logging system)
  getRecentLogs: publicProcedure
    .input(
      z.object({
        level: z.enum(["debug", "info", "warn", "error"]).optional(),
        component: z.string().optional(),
        limit: z.number().positive().max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching recent logs", input);

          // Placeholder implementation - in a real system, you'd query a logs table
          const logs = [
            {
              id: "log_1",
              level: "info",
              message: "Trading bot started successfully",
              component: "trading-orchestrator",
              timestamp: new Date(Date.now() - 60_000).toISOString(),
              metadata: {
                version: "1.0.0",
              },
            },
            {
              id: "log_2",
              level: "warn",
              message: "API response time above threshold",
              component: "mexc-client",
              timestamp: new Date(Date.now() - 30_000).toISOString(),
              metadata: {
                responseTime: 1200,
                threshold: 1000,
              },
            },
            {
              id: "log_3",
              level: "error",
              message: "Trade execution failed",
              component: "trade-executor",
              timestamp: new Date(Date.now() - 15_000).toISOString(),
              metadata: {
                symbol: "BTCUSDT",
                error: "Insufficient balance",
              },
            },
          ];

          // Apply filters
          let filteredLogs = logs;

          if (input.level) {
            filteredLogs = filteredLogs.filter(
              (log) => log.level === input.level
            );
          }

          if (input.component) {
            filteredLogs = filteredLogs.filter((log) =>
              log.component
                .toLowerCase()
                .includes(input.component?.toLowerCase())
            );
          }

          // Apply limit
          const limitedLogs = filteredLogs.slice(0, input.limit);

          yield* TradingLogger.logInfo("Recent logs fetched successfully", {
            total: filteredLogs.length,
            returned: limitedLogs.length,
            filters: {
              level: input.level,
              component: input.component,
            },
          });

          return {
            logs: limitedLogs,
            total: filteredLogs.length,
            requested: input.limit,
            timestamp: new Date().toISOString(),
          };
        })
      );
    }),
});

// Helper function to convert time range to milliseconds
const getTimeRangeMs = (timeRange: string): number => {
  switch (timeRange) {
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // Default to 24 hours
  }
};
