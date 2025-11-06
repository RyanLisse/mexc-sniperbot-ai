import { Effect, Layer, Context } from "effect";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, and, desc, gt, lt, gte, lte } from "drizzle-orm";
import { botStatus, tradeAttempt, listingEvent } from "@mexc-sniperbot-ai/db";
import { TradingError, TradingLogger } from "../lib/effect";
import { mexcClient } from "./mexc-client";

// Service interface for dependency injection
export type PerformanceMonitorService = {
  collectMetrics: () => Effect.Effect<PerformanceMetrics, TradingError>;
  getMetricsHistory: (timeRange: TimeRange) => Effect.Effect<MetricsHistory[], TradingError>;
  analyzePerformance: (timeRange: TimeRange) => Effect.Effect<PerformanceAnalysis, TradingError>;
  getSystemHealth: () => Effect.Effect<SystemHealth, TradingError>;
  generatePerformanceReport: (timeRange: TimeRange) => Effect.Effect<PerformanceReport, TradingError>;
};

// Service tag
export const PerformanceMonitorService = Context.Tag<PerformanceMonitorService>("PerformanceMonitorService");

// Type definitions
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PerformanceMetrics {
  timestamp: Date;
  bot: {
    isRunning: boolean;
    uptime: number;
    lastHeartbeat: Date;
    apiResponseTime: number;
    mexcApiStatus: string;
  };
  trading: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    averageExecutionTime: number;
    totalVolume: number;
    totalValue: number;
  };
  listings: {
    newListingsDetected: number;
    averageListingPrice: number;
    mostRecentListing: Date | null;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    databaseConnections: number;
  };
}

export interface MetricsHistory {
  timestamp: Date;
  botStatus: string;
  tradeCount: number;
  averageExecutionTime: number;
  apiResponseTime: number;
  errorCount: number;
}

export interface PerformanceAnalysis {
  overall: {
    grade: "A" | "B" | "C" | "D" | "F";
    score: number;
    summary: string;
  };
  bottlenecks: Array<{
    component: string;
    issue: string;
    severity: "low" | "medium" | "high" | "critical";
    recommendation: string;
  }>;
  trends: {
    executionTime: "improving" | "stable" | "degrading";
    successRate: "improving" | "stable" | "degrading";
    apiResponseTime: "improving" | "stable" | "degrading";
  };
  recommendations: string[];
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  components: Record<string, {
    status: "operational" | "degraded" | "down";
    message?: string;
    responseTime?: number;
    lastChecked: Date;
  }>;
  issues: Array<{
    type: "performance" | "connectivity" | "resource";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }>;
  uptime: number;
}

export interface PerformanceReport {
  generatedAt: Date;
  timeRange: TimeRange;
  summary: {
    totalTrades: number;
    successRate: number;
    averageExecutionTime: number;
    totalValue: number;
    uptime: number;
  };
  analysis: PerformanceAnalysis;
  health: SystemHealth;
  detailedMetrics: PerformanceMetrics[];
}

// Implementation class
export class PerformanceMonitor implements PerformanceMonitorService {
  private readonly metricsHistory: PerformanceMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;

  // Collect current performance metrics
  collectMetrics = (): Effect.Effect<PerformanceMetrics, TradingError> => {
    return Effect.gen(function* () {
      const timestamp = new Date();

      yield* TradingLogger.logDebug("Collecting performance metrics");

      try {
        // Collect bot metrics
        const botMetrics = yield* this.collectBotMetrics();

        // Collect trading metrics
        const tradingMetrics = yield* this.collectTradingMetrics();

        // Collect listing metrics
        const listingMetrics = yield* this.collectListingMetrics();

        // Collect system metrics
        const systemMetrics = yield* this.collectSystemMetrics();

        const metrics: PerformanceMetrics = {
          timestamp,
          bot: botMetrics,
          trading: tradingMetrics,
          listings: listingMetrics,
          system: systemMetrics,
        };

        // Store in history
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
          this.metricsHistory.shift();
        }

        yield* TradingLogger.logDebug("Performance metrics collected", {
          botRunning: botMetrics.isRunning,
          tradeCount: tradingMetrics.totalTrades,
          successRate: tradingMetrics.successRate,
        });

        return metrics;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Metrics collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "METRICS_COLLECTION_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get metrics history for a time range
  getMetricsHistory = (timeRange: TimeRange): Effect.Effect<MetricsHistory[], TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Fetching metrics history", timeRange);

      try {
        // Get bot status history
        const botStatusHistory = yield* Effect.tryPromise({
          try: () => db.select()
            .from(botStatus)
            .where(and(
              gte(botStatus.lastHeartbeat, timeRange.start),
              lte(botStatus.lastHeartbeat, timeRange.end)
            ))
            .orderBy(desc(botStatus.lastHeartbeat)),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to fetch bot status history: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "BOT_STATUS_HISTORY_FAILED",
              timestamp: new Date(),
            });
          },
        });

        // Get trade history
        const tradeHistory = yield* Effect.tryPromise({
          try: () => db.select()
            .from(tradeAttempt)
            .where(and(
              gte(tradeAttempt.createdAt, timeRange.start),
              lte(tradeAttempt.createdAt, timeRange.end)
            ))
            .orderBy(desc(tradeAttempt.createdAt)),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to fetch trade history: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_HISTORY_FAILED",
              timestamp: new Date(),
            });
          },
        });

        // Aggregate metrics by time periods (hourly)
        const hourlyMetrics = new Map<string, MetricsHistory>();

        // Process bot status data
        botStatusHistory.forEach(status => {
          const hourKey = new Date(status.lastHeartbeat).toISOString().substring(0, 13); // YYYY-MM-DDTHH
          
          if (!hourlyMetrics.has(hourKey)) {
            hourlyMetrics.set(hourKey, {
              timestamp: new Date(hourKey),
              botStatus: status.isRunning ? "running" : "stopped",
              tradeCount: 0,
              averageExecutionTime: 0,
              apiResponseTime: status.apiResponseTime,
              errorCount: 0,
            });
          }
        });

        // Process trade data
        const tradesByHour = new Map<string, typeof tradeHistory>();
        tradeHistory.forEach(trade => {
          const hourKey = new Date(trade.createdAt).toISOString().substring(0, 13);
          
          if (!tradesByHour.has(hourKey)) {
            tradesByHour.set(hourKey, []);
          }
          tradesByHour.get(hourKey)!.push(trade);
        });

        // Combine metrics
        tradesByHour.forEach((trades, hourKey) => {
          const successfulTrades = trades.filter(t => t.status === "SUCCESS");
          const failedTrades = trades.filter(t => t.status === "FAILED");
          const executionTimes = successfulTrades
            .map(t => t.executionTimeMs || 0)
            .filter(time => time > 0);

          const averageExecutionTime = executionTimes.length > 0
            ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
            : 0;

          const existing = hourlyMetrics.get(hourKey) || {
            timestamp: new Date(hourKey),
            botStatus: "unknown",
            tradeCount: 0,
            averageExecutionTime: 0,
            apiResponseTime: 0,
            errorCount: 0,
          };

          hourlyMetrics.set(hourKey, {
            ...existing,
            tradeCount: trades.length,
            averageExecutionTime,
            errorCount: failedTrades.length,
          });
        });

        const history = Array.from(hourlyMetrics.values()).sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );

        yield* TradingLogger.logInfo("Metrics history fetched successfully", {
          timeRange,
          dataPoints: history.length,
        });

        return history;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Metrics history fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "METRICS_HISTORY_FETCH_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Analyze performance and identify issues
  analyzePerformance = (timeRange: TimeRange): Effect.Effect<PerformanceAnalysis, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Analyzing performance", timeRange);

      try {
        const history = yield* this.getMetricsHistory(timeRange);

        if (history.length === 0) {
          return {
            overall: {
              grade: "C",
              score: 50,
              summary: "Insufficient data for analysis",
            },
            bottlenecks: [],
            trends: {
              executionTime: "stable",
              successRate: "stable",
              apiResponseTime: "stable",
            },
            recommendations: ["Collect more performance data for analysis"],
          };
        }

        // Calculate trends
        const trends = this.calculateTrends(history);

        // Identify bottlenecks
        const bottlenecks = this.identifyBottlenecks(history);

        // Calculate overall score and grade
        const { score, grade, summary } = this.calculateOverallScore(history, bottlenecks);

        // Generate recommendations
        const recommendations = this.generateRecommendations(bottlenecks, trends);

        const analysis: PerformanceAnalysis = {
          overall: { score, grade, summary },
          bottlenecks,
          trends,
          recommendations,
        };

        yield* TradingLogger.logInfo("Performance analysis completed", {
          grade,
          score,
          bottleneckCount: bottlenecks.length,
        });

        return analysis;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Performance analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "PERFORMANCE_ANALYSIS_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get system health status
  getSystemHealth = (): Effect.Effect<SystemHealth, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Checking system health");

      try {
        const components: SystemHealth["components"] = {};
        const issues: SystemHealth["issues"] = [];

        // Check bot component
        try {
          const botStatuses = yield* Effect.tryPromise({
            try: () => db.select()
              .from(botStatus)
              .orderBy(desc(botStatus.lastHeartbeat))
              .limit(1),
            catch: () => [],
          });

          if (botStatuses.length > 0) {
            const latestStatus = botStatuses[0];
            const timeSinceLastHeartbeat = Date.now() - latestStatus.lastHeartbeat.getTime();
            
            components.bot = {
              status: latestStatus.isRunning && timeSinceLastHeartbeat < 60_000 
                ? "operational" 
                : timeSinceLastHeartbeat < 300_000 
                  ? "degraded" 
                  : "down",
              message: latestStatus.isRunning ? "Bot is running" : "Bot is stopped",
              responseTime: latestStatus.apiResponseTime,
              lastChecked: new Date(),
            };

            if (timeSinceLastHeartbeat > 60_000) {
              issues.push({
                type: "connectivity",
                severity: timeSinceLastHeartbeat > 300_000 ? "critical" : "high",
                message: `Bot heartbeat delay: ${Math.round(timeSinceLastHeartbeat / 1000)}s`,
              });
            }
          } else {
            components.bot = {
              status: "down",
              message: "No bot status data available",
              lastChecked: new Date(),
            };
            issues.push({
              type: "connectivity",
              severity: "critical",
              message: "No bot status data available",
            });
          }
        } catch (error) {
          components.bot = {
            status: "down",
            message: "Failed to check bot status",
            lastChecked: new Date(),
          };
          issues.push({
            type: "connectivity",
            severity: "critical",
            message: "Bot status check failed",
          });
        }

        // Check API component
        try {
          const apiStartTime = Date.now();
          yield* mexcClient.getServerTime();
          const apiResponseTime = Date.now() - apiStartTime;

          components.mexcApi = {
            status: apiResponseTime < 5_000 ? "operational" : "degraded",
            message: `API responded in ${apiResponseTime}ms`,
            responseTime: apiResponseTime,
            lastChecked: new Date(),
          };

          if (apiResponseTime > 5_000) {
            issues.push({
              type: "performance",
              severity: apiResponseTime > 10_000 ? "high" : "medium",
              message: `Slow API response: ${apiResponseTime}ms`,
            });
          }
        } catch (error) {
          components.mexcApi = {
            status: "down",
            message: "API connectivity failed",
            lastChecked: new Date(),
          };
          issues.push({
            type: "connectivity",
            severity: "critical",
            message: "API connectivity failed",
          });
        }

        // Check database component
        try {
          const dbStartTime = Date.now();
          yield* Effect.tryPromise({
            try: () => db.select().from(botStatus).limit(1),
            catch: () => [],
          });
          const dbResponseTime = Date.now() - dbStartTime;

          components.database = {
            status: dbResponseTime < 1_000 ? "operational" : "degraded",
            message: `Database responded in ${dbResponseTime}ms`,
            responseTime: dbResponseTime,
            lastChecked: new Date(),
          };

          if (dbResponseTime > 1_000) {
            issues.push({
              type: "performance",
              severity: dbResponseTime > 3_000 ? "high" : "medium",
              message: `Slow database response: ${dbResponseTime}ms`,
            });
          }
        } catch (error) {
          components.database = {
            status: "down",
            message: "Database connectivity failed",
            lastChecked: new Date(),
          };
          issues.push({
            type: "connectivity",
            severity: "critical",
            message: "Database connectivity failed",
          });
        }

        // Determine overall status
        const criticalIssues = issues.filter(i => i.severity === "critical");
        const highIssues = issues.filter(i => i.severity === "high");
        
        let status: SystemHealth["status"] = "healthy";
        if (criticalIssues.length > 0) {
          status = "unhealthy";
        } else if (highIssues.length > 0 || issues.length > 2) {
          status = "degraded";
        }

        // Calculate uptime (simplified - based on recent bot status)
        const uptime = components.bot.status === "operational" ? 100 : 0;

        const health: SystemHealth = {
          status,
          components,
          issues,
          uptime,
        };

        yield* TradingLogger.logInfo("System health check completed", {
          status,
          issueCount: issues.length,
          componentCount: Object.keys(components).length,
        });

        return health;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `System health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "SYSTEM_HEALTH_CHECK_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Generate comprehensive performance report
  generatePerformanceReport = (timeRange: TimeRange): Effect.Effect<PerformanceReport, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Generating performance report", timeRange);

      try {
        // Get current metrics
        const currentMetrics = yield* this.collectMetrics();

        // Get analysis
        const analysis = yield* this.analyzePerformance(timeRange);

        // Get health
        const health = yield* this.getSystemHealth();

        // Calculate summary
        const summary = {
          totalTrades: currentMetrics.trading.totalTrades,
          successRate: currentMetrics.trading.successRate,
          averageExecutionTime: currentMetrics.trading.averageExecutionTime,
          totalValue: currentMetrics.trading.totalValue,
          uptime: health.uptime,
        };

        const report: PerformanceReport = {
          generatedAt: new Date(),
          timeRange,
          summary,
          analysis,
          health,
          detailedMetrics: [currentMetrics],
        };

        yield* TradingLogger.logInfo("Performance report generated successfully", {
          grade: analysis.overall.grade,
          score: analysis.overall.score,
          healthStatus: health.status,
        });

        return report;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Performance report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "PERFORMANCE_REPORT_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Private helper methods

  private collectBotMetrics = (): Effect.Effect<PerformanceMetrics["bot"], TradingError> => {
    return Effect.gen(function* () {
      const botStatuses = yield* Effect.tryPromise({
        try: () => db.select()
          .from(botStatus)
          .orderBy(desc(botStatus.lastHeartbeat))
          .limit(1),
        catch: () => [],
      });

      if (botStatuses.length === 0) {
        return {
          isRunning: false,
          uptime: 0,
          lastHeartbeat: new Date(),
          apiResponseTime: 0,
          mexcApiStatus: "UNKNOWN",
        };
      }

      const latestStatus = botStatuses[0];
      const uptime = latestStatus.isRunning 
        ? Date.now() - latestStatus.lastHeartbeat.getTime()
        : 0;

      return {
        isRunning: latestStatus.isRunning,
        uptime,
        lastHeartbeat: latestStatus.lastHeartbeat,
        apiResponseTime: latestStatus.apiResponseTime,
        mexcApiStatus: latestStatus.mexcApiStatus,
      };
    });
  };

  private collectTradingMetrics = (): Effect.Effect<PerformanceMetrics["trading"], TradingError> => {
    return Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradeAttempt)
          .where(gt(tradeAttempt.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))), // Last 24 hours
        catch: () => [],
      });

      const successful = trades.filter(t => t.status === "SUCCESS");
      const failed = trades.filter(t => t.status === "FAILED");

      const executionTimes = successful
        .map(t => t.executionTimeMs || 0)
        .filter(time => time > 0);

      const averageExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
        : 0;

      const totalVolume = successful.reduce((sum, trade) => {
        const quantity = parseFloat(trade.executedQuantity || "0");
        return sum + quantity;
      }, 0);

      const totalValue = successful.reduce((sum, trade) => {
        const quantity = parseFloat(trade.executedQuantity || "0");
        const price = parseFloat(trade.executedPrice || "0");
        return sum + (quantity * price);
      }, 0);

      return {
        totalTrades: trades.length,
        successfulTrades: successful.length,
        failedTrades: failed.length,
        successRate: trades.length > 0 ? (successful.length / trades.length) * 100 : 0,
        averageExecutionTime,
        totalVolume,
        totalValue,
      };
    });
  };

  private collectListingMetrics = (): Effect.Effect<PerformanceMetrics["listings"], TradingError> => {
    return Effect.gen(function* () {
      const listings = yield* Effect.tryPromise({
        try: () => db.select()
          .from(listingEvent)
          .where(and(
            eq(listingEvent.eventType, "NEW_LISTING_DETECTED"),
            gt(listingEvent.detectedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )),
        catch: () => [],
      });

      const averagePrice = listings.length > 0
        ? listings.reduce((sum, listing) => sum + parseFloat(listing.price || "0"), 0) / listings.length
        : 0;

      const mostRecent = listings.length > 0 
        ? listings.reduce((newest, listing) => 
            listing.detectedAt > newest.detectedAt ? listing : newest
          ).detectedAt
        : null;

      return {
        newListingsDetected: listings.length,
        averageListingPrice: averagePrice,
        mostRecentListing: mostRecent,
      };
    });
  };

  private collectSystemMetrics = (): Effect.Effect<PerformanceMetrics["system"], TradingError> => {
    return Effect.sync(() => {
      const memUsage = process.memoryUsage();
      const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;

      return {
        memoryUsage: memoryUsageMB,
        cpuUsage: 0, // Would need a proper CPU monitoring library
        databaseConnections: 1, // Simplified - would need actual connection pool monitoring
      };
    });
  };

  private calculateTrends = (history: MetricsHistory[]): PerformanceAnalysis["trends"] => {
    if (history.length < 2) {
      return {
        executionTime: "stable",
        successRate: "stable",
        apiResponseTime: "stable",
      };
    }

    const recent = history.slice(-5);
    const older = history.slice(0, Math.min(5, history.length - 5));

    const calculateTrend = (recentValues: number[], olderValues: number[]): "improving" | "stable" | "degrading" => {
      if (recentValues.length === 0 || olderValues.length === 0) return "stable";

      const recentAvg = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
      const olderAvg = olderValues.reduce((sum, v) => sum + v, 0) / olderValues.length;

      const change = (recentAvg - olderAvg) / olderAvg;

      if (Math.abs(change) < 0.1) return "stable";
      return change > 0 ? "degrading" : "improving";
    };

    return {
      executionTime: calculateTrend(
        recent.map(h => h.averageExecutionTime),
        older.map(h => h.averageExecutionTime)
      ),
      successRate: calculateTrend(
        recent.map(h => h.tradeCount > 0 ? (h.tradeCount - h.errorCount) / h.tradeCount * 100 : 0),
        older.map(h => h.tradeCount > 0 ? (h.tradeCount - h.errorCount) / h.tradeCount * 100 : 0)
      ),
      apiResponseTime: calculateTrend(
        recent.map(h => h.apiResponseTime),
        older.map(h => h.apiResponseTime)
      ),
    };
  };

  private identifyBottlenecks = (history: MetricsHistory[]): PerformanceAnalysis["bottlenecks"] => {
    const bottlenecks: PerformanceAnalysis["bottlenecks"] = [];

    // Check for slow execution times
    const avgExecutionTime = history.reduce((sum, h) => sum + h.averageExecutionTime, 0) / history.length;
    if (avgExecutionTime > 2000) {
      bottlenecks.push({
        component: "trade-execution",
        issue: `Slow average execution time: ${avgExecutionTime.toFixed(0)}ms`,
        severity: avgExecutionTime > 5000 ? "critical" : "high",
        recommendation: "Optimize trade execution logic or check API performance",
      });
    }

    // Check for high error rates
    const totalTrades = history.reduce((sum, h) => sum + h.tradeCount, 0);
    const totalErrors = history.reduce((sum, h) => sum + h.errorCount, 0);
    const errorRate = totalTrades > 0 ? (totalErrors / totalTrades) * 100 : 0;

    if (errorRate > 10) {
      bottlenecks.push({
        component: "trading-system",
        issue: `High error rate: ${errorRate.toFixed(1)}%`,
        severity: errorRate > 25 ? "critical" : "high",
        recommendation: "Review error logs and improve error handling",
      });
    }

    // Check for API response time issues
    const avgApiResponseTime = history.reduce((sum, h) => sum + h.apiResponseTime, 0) / history.length;
    if (avgApiResponseTime > 3000) {
      bottlenecks.push({
        component: "mexc-api",
        issue: `Slow API response time: ${avgApiResponseTime.toFixed(0)}ms`,
        severity: avgApiResponseTime > 8000 ? "critical" : "medium",
        recommendation: "Check MEXC API status and consider request optimization",
      });
    }

    return bottlenecks;
  };

  private calculateOverallScore = (history: MetricsHistory[], bottlenecks: PerformanceAnalysis["bottlenecks"]) => {
    let score = 100;

    // Deduct points for bottlenecks
    bottlenecks.forEach(bottleneck => {
      switch (bottleneck.severity) {
        case "critical":
          score -= 30;
          break;
        case "high":
          score -= 20;
          break;
        case "medium":
          score -= 10;
          break;
        case "low":
          score -= 5;
          break;
      }
    });

    // Deduct points for poor metrics
    const avgExecutionTime = history.reduce((sum, h) => sum + h.averageExecutionTime, 0) / history.length;
    if (avgExecutionTime > 1000) score -= 10;
    if (avgExecutionTime > 3000) score -= 20;

    const totalTrades = history.reduce((sum, h) => sum + h.tradeCount, 0);
    const totalErrors = history.reduce((sum, h) => sum + h.errorCount, 0);
    const errorRate = totalTrades > 0 ? (totalErrors / totalTrades) * 100 : 0;
    if (errorRate > 5) score -= 10;
    if (errorRate > 15) score -= 20;

    score = Math.max(0, Math.min(100, score));

    let grade: "A" | "B" | "C" | "D" | "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";
    else grade = "F";

    const summary = score >= 80 
      ? "Excellent performance with minimal issues"
      : score >= 60
        ? "Acceptable performance with some areas for improvement"
        : "Poor performance requiring immediate attention";

    return { score, grade, summary };
  };

  private generateRecommendations = (bottlenecks: PerformanceAnalysis["bottlenecks"], trends: PerformanceAnalysis["trends"]): string[] => {
    const recommendations: string[] = [];

    // Add bottleneck-specific recommendations
    bottlenecks.forEach(bottleneck => {
      recommendations.push(bottleneck.recommendation);
    });

    // Add trend-based recommendations
    if (trends.executionTime === "degrading") {
      recommendations.push("Monitor execution time trends and optimize slow operations");
    }

    if (trends.successRate === "degrading") {
      recommendations.push("Investigate decreasing success rate and improve error handling");
    }

    if (trends.apiResponseTime === "degrading") {
      recommendations.push("Consider implementing API response caching or optimization");
    }

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring performance metrics");
      recommendations.push("Set up automated alerts for performance degradation");
    }

    return recommendations;
  };
}

// Create layer for dependency injection
export const PerformanceMonitorLive = Layer.succeed(
  PerformanceMonitorService,
  new PerformanceMonitor()
);

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
