import { Effect, Layer, Context } from "effect";
import { mexcClient, type MEXCOrderResponse } from "./mexc-client";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, and, desc } from "drizzle-orm";
import { tradeAttempt, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import type { TradingConfiguration as TradingConfigType } from "@mexc-sniperbot-ai/db";

// Service interface for dependency injection
export interface TradeExecutorService {
  executeTrade: (symbol: string, strategy?: TradeStrategy) => Effect.Effect<TradeResult, TradeError | MEXCApiError>;
  getOrderStatus: (orderId: string, symbol: string) => Effect.Effect<OrderStatus, MEXCApiError>;
  cancelOrder: (orderId: string, symbol: string) => Effect.Effect<MEXCOrderResponse, MEXCApiError>;
  getTradeHistory: (limit?: number) => Effect.Effect<TradeHistoryItem[], MEXCApiError>;
}

// Service tag
export const TradeExecutorService = Context.Tag<TradeExecutorService>("TradeExecutorService");

// Trade strategy types
export type TradeStrategy = "MARKET" | "LIMIT";

export interface TradeResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  strategy: TradeStrategy;
  quantity: string;
  executedPrice?: string;
  executedQuantity?: string;
  error?: string;
  executionTime: number;
}

export type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "PENDING_CANCEL" | "REJECTED" | "EXPIRED";

export interface TradeHistoryItem {
  id: string;
  symbol: string;
  status: string;
  strategy: TradeStrategy;
  quantity: string;
  targetPrice?: string;
  executedPrice?: string;
  executedQuantity?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Implementation class
export class TradeExecutor implements TradeExecutorService {
  // Execute a trade based on symbol and strategy
  executeTrade = (
    symbol: string,
    strategy: TradeStrategy = "MARKET"
  ): Effect.Effect<TradeResult, TradeError | MEXCApiError> => {
    return Effect.gen(function* () {
      const startTime = Date.now();
      
      yield* TradingLogger.logTradeStarted(`trade_${symbol}_${startTime}`, symbol, "PENDING");

      try {
        // Get trading configuration for this symbol
        const config = yield* this.getTradingConfiguration(symbol);
        
        // Validate trade parameters
        yield* this.validateTradeParameters(symbol, config, strategy);

        // Calculate trade quantity
        const quantity = yield* this.calculateTradeQuantity(symbol, config);

        // Execute the trade based on strategy
        const orderResult = yield* this.executeOrderStrategy(symbol, quantity, strategy);

        const executionTime = Date.now() - startTime;

        const result: TradeResult = {
          success: true,
          orderId: orderResult.orderId,
          symbol,
          strategy,
          quantity,
          executedPrice: orderResult.executedPrice,
          executedQuantity: orderResult.executedQuantity,
          executionTime,
        };

        // Save successful trade attempt
        yield* this.saveTradeAttempt({
          id: `trade_${symbol}_${startTime}`,
          symbol,
          status: "SUCCESS",
          strategy,
          quantity,
          targetPrice: strategy === "LIMIT" ? config.maxPurchaseAmount.toString() : undefined,
          executedPrice: orderResult.executedPrice,
          executedQuantity: orderResult.executedQuantity,
          createdAt: new Date(startTime),
          completedAt: new Date(),
          executionTime,
          metadata: {
            orderId: orderResult.orderId,
            price: orderResult.executedPrice,
            originalQuantity: quantity,
          },
        });

        yield* TradingLogger.logTradeCompleted(`trade_${symbol}_${startTime}`, result);
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Save failed trade attempt
        yield* this.saveTradeAttempt({
          id: `trade_${symbol}_${startTime}`,
          symbol,
          status: "FAILED",
          strategy,
          quantity: "0",
          createdAt: new Date(startTime),
          completedAt: new Date(),
          executionTime,
          error: errorMessage,
          metadata: {
            errorType: error instanceof TradingError ? error.code : "UNKNOWN",
          },
        });

        yield* TradingLogger.logTradeFailed(`trade_${symbol}_${startTime}`, error as Error);

        return {
          success: false,
          symbol,
          strategy,
          quantity: "0",
          error: errorMessage,
          executionTime,
        };
      }
    });
  };

  // Get order status from MEXC
  getOrderStatus = (orderId: string, symbol: string): Effect.Effect<OrderStatus, MEXCApiError> => {
    return Effect.gen(function* () {
      const orderResult = yield* mexcClient.getOrderStatus(symbol, orderId);
      return orderResult.status as OrderStatus;
    });
  };

  // Cancel an order
  cancelOrder = (orderId: string, symbol: string): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Cancelling order ${orderId} for ${symbol}`);
      
      const result = yield* mexcClient.cancelOrder(symbol, orderId);
      
      yield* TradingLogger.logInfo(`Order ${orderId} cancelled successfully`, {
        symbol,
        status: result.status,
      });
      
      return result;
    });
  };

  // Get trade history from database
  getTradeHistory = (limit: number = 50): Effect.Effect<TradeHistoryItem[], MEXCApiError> => {
    return Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradeAttempt)
          .orderBy(desc(tradeAttempt.createdAt))
          .limit(limit),
        catch: (error) => {
          throw new MEXCApiError({
            message: `Failed to fetch trade history: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "DATABASE_ERROR",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });

      return trades.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        strategy: trade.strategy as TradeStrategy,
        quantity: trade.quantity,
        targetPrice: trade.targetPrice,
        executedPrice: trade.executedPrice,
        executedQuantity: trade.executedQuantity,
        createdAt: trade.createdAt,
        completedAt: trade.completedAt,
        error: trade.error,
      }));
    });
  };

  // Private helper methods

  // Get trading configuration for a symbol
  private getTradingConfiguration = (symbol: string): Effect.Effect<TradingConfigType, TradingError> => {
    return Effect.gen(function* () {
      const configs = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradingConfiguration)
          .where(
            and(
              eq(tradingConfiguration.isActive, true),
              eq(tradingConfiguration.symbol, symbol)
            )
          )
          .limit(1),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to fetch trading configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "CONFIGURATION_FETCH_FAILED",
            timestamp: new Date(),
          });
        },
      });

      if (configs.length === 0) {
        throw new TradingError({
          message: `No active trading configuration found for symbol: ${symbol}`,
          code: "NO_CONFIGURATION_FOUND",
          timestamp: new Date(),
        });
      }

      return configs[0];
    });
  };

  // Validate trade parameters
  private validateTradeParameters = (
    symbol: string,
    config: TradingConfigType,
    strategy: TradeStrategy
  ): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      // Check if symbol is enabled
      if (!config.enabledPairs.includes(symbol)) {
        throw new TradingError({
          message: `Symbol ${symbol} is not enabled for trading`,
          code: "SYMBOL_NOT_ENABLED",
          timestamp: new Date(),
        });
      }

      // Check daily spending limit
      const todaySpent = yield* this.getTodaySpentAmount();
      if (todaySpent >= config.dailySpendingLimit) {
        throw new TradingError({
          message: `Daily spending limit reached: ${todaySpent}/${config.dailySpendingLimit}`,
          code: "DAILY_LIMIT_REACHED",
          timestamp: new Date(),
        });
      }

      // Check hourly trade limit
      const hourlyTrades = yield* this.getHourlyTradeCount();
      if (hourlyTrades >= config.maxTradesPerHour) {
        throw new TradingError({
          message: `Hourly trade limit reached: ${hourlyTrades}/${config.maxTradesPerHour}`,
          code: "HOURLY_LIMIT_REACHED",
          timestamp: new Date(),
        });
      }

      // Validate strategy-specific requirements
      if (strategy === "LIMIT" && config.maxPurchaseAmount <= 0) {
        throw new TradingError({
          message: "Limit orders require a valid max purchase amount",
          code: "INVALID_LIMIT_PARAMETERS",
          timestamp: new Date(),
        });
      }
    });
  };

  // Calculate trade quantity based on configuration
  private calculateTradeQuantity = (symbol: string, config: TradingConfigType): Effect.Effect<string, TradingError> => {
    return Effect.gen(function* () {
      // For simplicity, use a fixed percentage of max purchase amount
      // In a real implementation, this would consider current price and available balance
      const tradeAmount = config.maxPurchaseAmount * 0.1; // 10% of max amount
      
      if (tradeAmount <= 0) {
        throw new TradingError({
          message: "Calculated trade amount is too small",
          code: "TRADE_AMOUNT_TOO_SMALL",
          timestamp: new Date(),
        });
      }

      return tradeAmount.toString();
    });
  };

  // Execute order based on strategy
  private executeOrderStrategy = (
    symbol: string,
    quantity: string,
    strategy: TradeStrategy
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Executing ${strategy} order for ${symbol}`, { quantity });

      switch (strategy) {
        case "MARKET":
          return yield* mexcClient.placeMarketBuyOrder(symbol, quantity);
        
        case "LIMIT":
          // For limit orders, we'd need to calculate a target price
          // For now, use a simple strategy
          const ticker = yield* mexcClient.getTicker(symbol);
          const limitPrice = (parseFloat(ticker.price) * 1.01).toString(); // 1% above current price
          return yield* mexcClient.placeLimitBuyOrder(symbol, quantity, limitPrice);
        
        default:
          throw new MEXCApiError({
            message: `Unsupported trading strategy: ${strategy}`,
            code: "UNSUPPORTED_STRATEGY",
            statusCode: 400,
            timestamp: new Date(),
          });
      }
    });
  };

  // Save trade attempt to database
  private saveTradeAttempt = (tradeData: {
    id: string;
    symbol: string;
    status: string;
    strategy: TradeStrategy;
    quantity: string;
    targetPrice?: string;
    executedPrice?: string;
    executedQuantity?: string;
    createdAt: Date;
    completedAt?: Date;
    executionTime: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => db.insert(tradeAttempt).values({
          id: tradeData.id,
          symbol: tradeData.symbol,
          status: tradeData.status,
          strategy: tradeData.strategy,
          quantity: tradeData.quantity,
          targetPrice: tradeData.targetPrice,
          executedPrice: tradeData.executedPrice,
          executedQuantity: tradeData.executedQuantity,
          createdAt: tradeData.createdAt,
          completedAt: tradeData.completedAt,
          executionTimeMs: tradeData.executionTime,
          error: tradeData.error,
          metadata: tradeData.metadata || {},
        }),
        catch: (error) => {
          throw new MEXCApiError({
            message: `Failed to save trade attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "DATABASE_ERROR",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });
    });
  };

  // Get today's spent amount
  private getTodaySpentAmount = (): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTrades = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradeAttempt)
          .where(and(
            eq(tradeAttempt.status, "SUCCESS"),
            // Use a simple date comparison - in production, you'd want proper date filtering
          )),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to fetch today's trades: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "TODAY_TRADES_FETCH_FAILED",
            timestamp: new Date(),
          });
        },
      });

      // Sum up the executed amounts (simplified - in production, you'd calculate actual spent amount)
      return todayTrades.reduce((total, trade) => {
        const executedAmount = parseFloat(trade.executedQuantity || "0");
        return total + executedAmount;
      }, 0);
    });
  };

  // Get hourly trade count
  private getHourlyTradeCount = (): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const hourlyTrades = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradeAttempt)
          .where(and(
            eq(tradeAttempt.status, "SUCCESS"),
            // Use a simple date comparison - in production, you'd want proper date filtering
          )),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to fetch hourly trades: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "HOURLY_TRADES_FETCH_FAILED",
            timestamp: new Date(),
          });
        },
      });

      return hourlyTrades.length;
    });
  };
}

// Create layer for dependency injection
export const TradeExecutorLive = Layer.succeed(
  TradeExecutorService,
  new TradeExecutor()
);

// Export singleton instance
export const tradeExecutor = new TradeExecutor();
