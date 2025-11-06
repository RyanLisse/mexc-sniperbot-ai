import { Effect, Layer, Context } from "effect";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, and, desc, gte, lte, lt } from "drizzle-orm";
import { tradeAttempt } from "@mexc-sniperbot-ai/db";
import { TradingError, TradingLogger } from "../lib/effect";
import type { TradeResult } from "./trade-executor";

// Service interface for dependency injection
export type TradeLoggerService = {
  logTradeAttempt: (tradeData: TradeAttemptLogData) => Effect.Effect<void, TradingError>;
  logTradeSuccess: (tradeData: TradeResult) => Effect.Effect<void, TradingError>;
  logTradeFailure: (tradeData: TradeResult, error: Error) => Effect.Effect<void, TradingError>;
  getTradeLogs: (filters: TradeLogFilters) => Effect.Effect<TradeLogEntry[], TradingError>;
  getTradeStatistics: (timeRange: TimeRange) => Effect.Effect<TradeLogStatistics, TradingError>;
  exportTradeLogs: (filters: TradeLogFilters) => Effect.Effect<string, TradingError>;
};

// Service tag
export const TradeLoggerService = Context.Tag<TradeLoggerService>("TradeLoggerService");

// Type definitions
export type TradeAttemptLogData = {
  id: string;
  symbol: string;
  strategy: "MARKET" | "LIMIT";
  quantity: string;
  targetPrice?: string;
  createdAt: Date;
};

export type TradeLogFilters = {
  symbol?: string;
  status?: "SUCCESS" | "FAILED" | "PENDING";
  strategy?: "MARKET" | "LIMIT";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

export type TimeRange = {
  start: Date;
  end: Date;
};

export type TradeLogEntry = {
  id: string;
  symbol: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  strategy: "MARKET" | "LIMIT";
  quantity: string;
  targetPrice?: string;
  executedPrice?: string;
  executedQuantity?: string;
  createdAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  error?: string;
  value: number;
};

export type TradeLogStatistics = {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  pendingTrades: number;
  successRate: number;
  averageExecutionTime: number;
  totalVolume: number;
  totalValue: number;
  averageTradeValue: number;
  mostTradedSymbol: string;
  mostUsedStrategy: "MARKET" | "LIMIT";
};

// Implementation class
export class TradeLogger implements TradeLoggerService {
  // Log a trade attempt (initial creation)
  logTradeAttempt = (tradeData: TradeAttemptLogData): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Logging trade attempt", tradeData);

      try {
        yield* Effect.tryPromise({
          try: () => db.insert(tradeAttempt).values({
            id: tradeData.id,
            symbol: tradeData.symbol,
            status: "PENDING",
            strategy: tradeData.strategy,
            quantity: tradeData.quantity,
            targetPrice: tradeData.targetPrice,
            createdAt: new Date(),
            metadata: tradeData.metadata || {},
          }),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to log trade attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_LOG_FAILED",
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logDebug("Trade attempt logged successfully", {
          id: tradeData.id,
          symbol: tradeData.symbol,
        });
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade logging failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_LOGGING_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Log a successful trade completion
  logTradeSuccess = (tradeData: TradeResult): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      if (!tradeData.orderId) {
        throw new TradingError({
          message: "Cannot log successful trade without order ID",
          code: "MISSING_ORDER_ID",
          timestamp: new Date(),
        });
      }

      yield* TradingLogger.logInfo("Logging successful trade", {
        orderId: tradeData.orderId,
        symbol: tradeData.symbol,
        executedPrice: tradeData.executedPrice,
      });

      try {
        yield* Effect.tryPromise({
          try: () => db.update(tradeAttempt)
            .set({
              status: "SUCCESS",
              executedPrice: tradeData.executedPrice,
              executedQuantity: tradeData.executedQuantity,
              completedAt: new Date(),
              executionTimeMs: tradeData.executionTime,
              metadata: {
                orderId: tradeData.orderId,
                executionTime: tradeData.executionTime,
              },
            })
            .where(eq(tradeAttempt.id, `trade_${tradeData.symbol}_${tradeData.orderId}`)),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to log successful trade: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_SUCCESS_LOG_FAILED",
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logInfo("Successful trade logged", {
          orderId: tradeData.orderId,
          symbol: tradeData.symbol,
        });
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade success logging failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_SUCCESS_LOGGING_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Log a failed trade
  logTradeFailure = (tradeData: TradeResult, error: Error): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      const tradeId = `trade_${tradeData.symbol}_${Date.now()}`;

      yield* TradingLogger.logError("Logging failed trade", error, {
        symbol: tradeData.symbol,
        strategy: tradeData.strategy,
      });

      try {
        yield* Effect.tryPromise({
          try: () => db.insert(tradeAttempt).values({
            id: tradeId,
            symbol: tradeData.symbol,
            status: "FAILED",
            strategy: tradeData.strategy,
            quantity: tradeData.quantity,
            createdAt: new Date(),
            completedAt: new Date(),
            executionTimeMs: tradeData.executionTime,
            error: error.message,
            metadata: {
              errorType: error.constructor.name,
              stack: error.stack,
            },
          }),
          catch: (dbError) => {
            throw new TradingError({
              message: `Failed to log failed trade: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
              code: "TRADE_FAILURE_LOG_FAILED",
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logInfo("Failed trade logged", {
          id: tradeId,
          symbol: tradeData.symbol,
          error: error.message,
        });
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade failure logging failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_FAILURE_LOGGING_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get trade logs with filters
  getTradeLogs = (filters: TradeLogFilters): Effect.Effect<TradeLogEntry[], TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Fetching trade logs", filters);

      try {
        let query = db.select().from(tradeAttempt);

        // Apply filters
        if (filters.symbol) {
          query = query.where(eq(tradeAttempt.symbol, filters.symbol));
        }

        if (filters.status) {
          query = query.where(eq(tradeAttempt.status, filters.status));
        }

        if (filters.strategy) {
          query = query.where(eq(tradeAttempt.strategy, filters.strategy));
        }

        if (filters.startTime) {
          query = query.where(gte(tradeAttempt.createdAt, filters.startTime));
        }

        if (filters.endTime) {
          query = query.where(lte(tradeAttempt.createdAt, filters.endTime));
        }

        // Apply pagination
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        const logs = yield* Effect.tryPromise({
          try: () => query
            .orderBy(desc(tradeAttempt.createdAt))
            .limit(limit)
            .offset(offset),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to fetch trade logs: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_LOGS_FETCH_FAILED",
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logInfo("Trade logs fetched successfully", {
          count: logs.length,
          filters,
        });

        return logs.map(log => ({
          ...log,
          metadata: log.metadata || {},
        }));
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade logs fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_LOGS_FETCH_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get trade statistics for a time range
  getTradeStatistics = (timeRange: TimeRange): Effect.Effect<TradeLogStatistics, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Calculating trade statistics", timeRange);

      try {
        const trades = yield* Effect.tryPromise({
          try: () => db.select()
            .from(tradeAttempt)
            .where(and(
              gte(tradeAttempt.createdAt, timeRange.start),
              lte(tradeAttempt.createdAt, timeRange.end)
            )),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to fetch trades for statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_STATS_FETCH_FAILED",
              timestamp: new Date(),
            });
          },
        });

        const successful = trades.filter(t => t.status === "SUCCESS");
        const failed = trades.filter(t => t.status === "FAILED");
        const pending = trades.filter(t => t.status === "PENDING");

        // Calculate most traded symbol
        const symbolCounts = trades.reduce((acc, trade) => {
          acc[trade.symbol] = (acc[trade.symbol] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const mostTradedSymbol = Object.keys(symbolCounts).reduce((a, b) => 
          symbolCounts[a] > symbolCounts[b] ? a : b, ""
        );

        // Calculate execution times
        const executionTimes = successful
          .map(t => t.executionTimeMs || 0)
          .filter(time => time > 0);

        const fastestExecution = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
        const slowestExecution = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

        // Calculate volume and value (simplified)
        const totalVolume = successful.reduce((sum, trade) => {
          const quantity = parseFloat(trade.executedQuantity || "0");
          return sum + quantity;
        }, 0);

        const totalValue = successful.reduce((sum, trade) => {
          const quantity = parseFloat(trade.executedQuantity || "0");
          const price = parseFloat(trade.executedPrice || "0");
          return sum + (quantity * price);
        }, 0);

        const statistics: TradeLogStatistics = {
          total: trades.length,
          successful: successful.length,
          failed: failed.length,
          pending: pending.length,
          successRate: trades.length > 0 ? (successful.length / trades.length) * 100 : 0,
          averageExecutionTime: executionTimes.length > 0 
            ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
            : 0,
          totalVolume,
          totalValue,
          mostTradedSymbol,
          fastestExecution,
          slowestExecution,
        };

        yield* TradingLogger.logInfo("Trade statistics calculated", statistics);

        return statistics;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade statistics calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_STATS_CALCULATION_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Export trade logs as CSV
  exportTradeLogs = (filters: TradeLogFilters): Effect.Effect<string, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Exporting trade logs", filters);

      try {
        const logs = yield* this.getTradeLogs({
          ...filters,
          limit: 1000, // Limit export size
        });

        // Generate CSV
        const headers = [
          "ID", "Symbol", "Status", "Strategy", "Quantity", 
          "Target Price", "Executed Price", "Executed Quantity",
          "Created At", "Completed At", "Execution Time (ms)", "Error"
        ];

        const csvRows = [
          headers.join(","),
          ...logs.map(log => [
            log.id,
            log.symbol,
            log.status,
            log.strategy,
            log.quantity,
            log.targetPrice || "",
            log.executedPrice || "",
            log.executedQuantity || "",
            log.createdAt.toISOString(),
            log.completedAt?.toISOString() || "",
            log.executionTimeMs || "",
            log.error || ""
          ].join(","))
        ];

        const csv = csvRows.join("\n");

        yield* TradingLogger.logInfo("Trade logs exported successfully", {
          recordCount: logs.length,
          filters,
        });

        return csv;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade logs export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_LOGS_EXPORT_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Clean up old trade logs
  cleanupOldLogs = (olderThanDays: number = 30): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      yield* TradingLogger.logInfo("Cleaning up old trade logs", {
        olderThanDays,
        cutoffDate: cutoffDate.toISOString(),
      });

      try {
        const result = yield* Effect.tryPromise({
          try: () => db.delete(tradeAttempt)
            .where(lt(tradeAttempt.createdAt, cutoffDate)),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to cleanup old trade logs: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "TRADE_LOGS_CLEANUP_FAILED",
              timestamp: new Date(),
            });
          },
        });

        const deletedCount = result.rowCount || 0;

        yield* TradingLogger.logInfo("Old trade logs cleaned up successfully", {
          deletedCount,
          olderThanDays,
        });

        return deletedCount;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Trade logs cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "TRADE_LOGS_CLEANUP_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };
}

// Create layer for dependency injection
export const TradeLoggerLive = Layer.succeed(
  TradeLoggerService,
  new TradeLogger()
);

// Export singleton instance
export const tradeLogger = new TradeLogger();
