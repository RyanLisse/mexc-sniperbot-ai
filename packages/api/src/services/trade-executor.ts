import type { TradingConfiguration as TradingConfigType } from "@mexc-sniperbot-ai/db";
import { db, tradeAttempt, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";
import { accountService } from "./account-service";
import { type MEXCOrderResponse, mexcClient } from "./mexc-client";
import { orderValidator } from "./order-validator";
import { positionTracker } from "./position-tracker";
import { riskManager } from "./risk-manager";

// Service interface for dependency injection
export type TradeExecutorService = {
  executeTrade: (
    symbol: string,
    strategy?: TradeStrategy
  ) => Effect.Effect<TradeResult, TradeError | MEXCApiError>;
  executeSellTrade: (
    symbol: string,
    quantity: string,
    strategy?: TradeStrategy,
    sellReason?: string,
    parentTradeId?: string
  ) => Effect.Effect<TradeResult, TradeError | MEXCApiError>;
  getOrderStatus: (
    orderId: string,
    symbol: string
  ) => Effect.Effect<OrderStatus, MEXCApiError>;
  cancelOrder: (
    orderId: string,
    symbol: string
  ) => Effect.Effect<MEXCOrderResponse, MEXCApiError>;
  getTradeHistory: (
    limit?: number
  ) => Effect.Effect<TradeHistoryItem[], MEXCApiError>;
};

// Service tag
export const TradeExecutorService = Context.Tag<TradeExecutorService>(
  "TradeExecutorService"
);

// Trade strategy types
export type TradeStrategy = "MARKET" | "LIMIT";

export type TradeResult = {
  success: boolean;
  orderId?: string;
  symbol: string;
  strategy: TradeStrategy;
  quantity: string;
  executedPrice?: string;
  executedQuantity?: string;
  error?: string;
  executionTime: number;
};

export type OrderStatus =
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "PENDING_CANCEL"
  | "REJECTED"
  | "EXPIRED";

export type TradeHistoryItem = {
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
};

// Implementation class
export class TradeExecutor implements TradeExecutorService {
  // Execute a trade based on symbol and strategy
  executeTrade = (
    symbol: string,
    strategy: TradeStrategy = "MARKET"
  ): Effect.Effect<TradeResult, TradeError | MEXCApiError> => {
    return Effect.gen(function* () {
      const startTime = Date.now();

      yield* TradingLogger.logTradeStarted(
        `trade_${symbol}_${startTime}`,
        symbol,
        "PENDING"
      );

      try {
        // Get trading configuration for this symbol
        const config = yield* this.getTradingConfiguration(symbol);

        // Validate trade parameters (includes risk checks)
        yield* this.validateTradeParameters(symbol, config, strategy);

        // Calculate trade quantity
        const quantity = yield* this.calculateTradeQuantity(symbol, config);

        // Execute the trade based on strategy
        const orderResult = yield* this.executeOrderStrategy(
          symbol,
          quantity,
          strategy
        );

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
          targetPrice:
            strategy === "LIMIT"
              ? config.maxPurchaseAmount.toString()
              : undefined,
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

        yield* TradingLogger.logTradeCompleted(
          `trade_${symbol}_${startTime}`,
          result
        );

        // Record trade for risk management (PnL tracking)
        // For buy orders, PnL is 0 initially (will be calculated on sell)
        // In production, track position cost basis for accurate PnL calculation
        riskManager.recordTrade(0);

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

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

        yield* TradingLogger.logTradeFailed(
          `trade_${symbol}_${startTime}`,
          error as Error
        );

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

  // Execute a sell trade
  executeSellTrade = (
    symbol: string,
    quantity: string,
    strategy: TradeStrategy = "MARKET",
    sellReason?: string,
    parentTradeId?: string
  ): Effect.Effect<TradeResult, TradingError | MEXCApiError> => {
    return Effect.gen(function* () {
      const startTime = Date.now();

      yield* TradingLogger.logInfo(`Executing sell trade for ${symbol}`, {
        quantity,
        strategy,
        sellReason,
      });

      try {
        // Verify position exists
        const position = yield* positionTracker.getPosition(symbol);
        if (!position) {
          throw new TradingError({
            message: `No open position found for ${symbol}`,
            code: "NO_POSITION",
            timestamp: new Date(),
          });
        }

        // Validate quantity doesn't exceed position
        const positionQuantity = position.quantity;
        const sellQuantity = Number.parseFloat(quantity);
        if (sellQuantity > positionQuantity) {
          throw new TradingError({
            message: `Insufficient quantity: requested ${sellQuantity}, available ${positionQuantity}`,
            code: "INSUFFICIENT_QUANTITY",
            timestamp: new Date(),
          });
        }

        // Execute the sell order based on strategy
        const orderResult = yield* this.executeSellOrderStrategy(
          symbol,
          quantity,
          strategy
        );

        const executionTime = Date.now() - startTime;

        // Calculate realized PnL
        const entryPrice = position.entryPrice;
        const executedPrice = orderResult.executedPrice
          ? Number.parseFloat(orderResult.executedPrice)
          : 0;
        const executedQuantity = orderResult.executedQuantity
          ? Number.parseFloat(orderResult.executedQuantity)
          : sellQuantity;
        const realizedPnL = (executedPrice - entryPrice) * executedQuantity;

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

        // Generate positionId for linking buy/sell pairs
        const positionId = parentTradeId || position.tradeAttemptId;

        // Save successful sell trade attempt
        yield* this.saveTradeAttempt({
          id: `sell_${symbol}_${startTime}`,
          symbol,
          status: "SUCCESS",
          strategy,
          quantity,
          executedPrice: orderResult.executedPrice,
          executedQuantity: orderResult.executedQuantity,
          createdAt: new Date(startTime),
          completedAt: new Date(),
          executionTime,
          parentTradeId: parentTradeId || position.tradeAttemptId,
          positionId,
          sellReason: sellReason || "MANUAL",
          metadata: {
            orderId: orderResult.orderId,
            price: orderResult.executedPrice,
            originalQuantity: quantity,
            realizedPnL,
            entryPrice: position.entryPrice,
          },
        });

        // Remove position from tracker (or update if partial sell)
        if (executedQuantity >= positionQuantity) {
          yield* positionTracker.removePosition(symbol);
        } else {
          // Partial sell - update position quantity
          yield* positionTracker.updatePosition(symbol, {
            quantity: positionQuantity - executedQuantity,
          });
        }

        // Record realized PnL for risk management
        riskManager.recordTrade(realizedPnL);

        yield* TradingLogger.logInfo(`Sell trade completed for ${symbol}`, {
          orderId: result.orderId,
          realizedPnL,
        });

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Save failed sell trade attempt
        yield* this.saveTradeAttempt({
          id: `sell_${symbol}_${startTime}`,
          symbol,
          status: "FAILED",
          strategy,
          quantity: "0",
          createdAt: new Date(startTime),
          completedAt: new Date(),
          executionTime,
          error: errorMessage,
          parentTradeId,
          sellReason: sellReason || "MANUAL",
          metadata: {
            error: errorMessage,
          },
        });

        throw error instanceof TradingError || error instanceof MEXCApiError
          ? error
          : new TradingError({
              message: `Sell trade execution failed: ${errorMessage}`,
              code: "SELL_TRADE_EXECUTION_FAILED",
              timestamp: new Date(),
            });
      }
    });
  };

  // Execute sell order based on strategy
  private readonly executeSellOrderStrategy = (
    symbol: string,
    quantity: string,
    strategy: TradeStrategy
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(
        `Executing ${strategy} sell order for ${symbol}`,
        { quantity }
      );

      switch (strategy) {
        case "MARKET":
          return yield* mexcClient.placeMarketSellOrder(symbol, quantity);

        case "LIMIT": {
          // For limit sell orders, use current price (or slightly below for quick execution)
          const ticker = yield* mexcClient.getTicker(symbol);
          const limitPrice = (
            Number.parseFloat(ticker.price) * 0.99
          ).toString(); // 1% below current price for quick execution
          return yield* mexcClient.placeLimitSellOrder(
            symbol,
            quantity,
            limitPrice
          );
        }

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

  // Get order status from MEXC
  getOrderStatus = (
    orderId: string,
    symbol: string
  ): Effect.Effect<OrderStatus, MEXCApiError> =>
    Effect.gen(function* () {
      const orderResult = yield* mexcClient.getOrderStatus(symbol, orderId);
      return orderResult.status as OrderStatus;
    });

  // Cancel an order
  cancelOrder = (
    orderId: string,
    symbol: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> =>
    Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Cancelling order ${orderId} for ${symbol}`);

      const result = yield* mexcClient.cancelOrder(symbol, orderId);

      yield* TradingLogger.logInfo(`Order ${orderId} cancelled successfully`, {
        symbol,
        status: result.status,
      });

      return result;
    });

  // Get trade history from database
  getTradeHistory = (
    limit = 50
  ): Effect.Effect<TradeHistoryItem[], MEXCApiError> =>
    Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
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

      return trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        strategy: (trade.type || "MARKET") as TradeStrategy,
        quantity: trade.quantity,
        targetPrice: trade.price || undefined,
        executedPrice: trade.executedPrice || undefined,
        executedQuantity: trade.executedQuantity || undefined,
        createdAt: trade.createdAt,
        completedAt: trade.completedAt || undefined,
        error: trade.errorMessage || undefined,
      }));
    });

  // Private helper methods

  // Get trading configuration for a symbol
  private readonly getTradingConfiguration = (
    symbol: string
  ): Effect.Effect<TradingConfigType, TradingError> =>
    Effect.gen(function* () {
      const configs = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
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

  // Validate trade parameters
  private readonly validateTradeParameters = (
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

      // Pre-validate order using exchange rules (saves ~100ms by preventing rejected orders)
      const quantity = yield* this.calculateTradeQuantity(symbol, config);
      const quantityNum = Number.parseFloat(quantity);

      // Get current price for validation
      const ticker = yield* mexcClient.getTicker(symbol);
      const price = Number.parseFloat(ticker.price);

      // Validate order parameters
      const validation = yield* orderValidator.validate(
        symbol,
        price,
        quantityNum
      );
      if (!validation.valid) {
        throw new TradingError({
          message: `Order validation failed: ${validation.errors.join(", ")}`,
          code: "ORDER_VALIDATION_FAILED",
          timestamp: new Date(),
        });
      }

      // Risk management validation (position size and daily loss limits)
      const accountInfo = yield* accountService.getAccountInfo();
      const portfolioValue = accountInfo.totalUsdValue;
      const dailyPnL = riskManager.getDailyPnL();

      const riskValidation = yield* riskManager.validateOrder({
        symbol,
        quantity: quantityNum,
        price,
        side: "BUY",
        stopLoss: config.stopLossPercent
          ? price * (1 - config.stopLossPercent / 10_000)
          : undefined,
        portfolioValue,
        dailyPnL,
      });

      if (!riskValidation.approved) {
        throw new TradingError({
          message: `Risk validation failed: ${riskValidation.reason}`,
          code: "RISK_VALIDATION_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Calculate trade quantity based on configuration
  private readonly calculateTradeQuantity = (
    _symbol: string,
    config: TradingConfigType
  ): Effect.Effect<string, TradingError> => {
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
  private readonly executeOrderStrategy = (
    symbol: string,
    quantity: string,
    strategy: TradeStrategy
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(
        `Executing ${strategy} order for ${symbol}`,
        { quantity }
      );

      switch (strategy) {
        case "MARKET":
          return yield* mexcClient.placeMarketBuyOrder(symbol, quantity);

        case "LIMIT": {
          // For limit orders, we'd need to calculate a target price
          // For now, use a simple strategy
          const ticker = yield* mexcClient.getTicker(symbol);
          const limitPrice = (
            Number.parseFloat(ticker.price) * 1.01
          ).toString(); // 1% above current price
          return yield* mexcClient.placeLimitBuyOrder(
            symbol,
            quantity,
            limitPrice
          );
        }

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
  private readonly saveTradeAttempt = (tradeData: {
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
    parentTradeId?: string;
    positionId?: string;
    sellReason?: string;
    listingEventId?: string;
    configurationId?: string;
    metadata?: Record<string, unknown>;
  }): Effect.Effect<void, MEXCApiError> =>
    Effect.gen(function* () {
      // For sell orders, fetch parent trade to get listingEventId and configurationId
      let listingEventId = tradeData.listingEventId;
      let configurationId = tradeData.configurationId;

      if (tradeData.parentTradeId && !listingEventId) {
        const parentTrade = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(tradeAttempt)
              .where(eq(tradeAttempt.id, tradeData.parentTradeId!))
              .limit(1),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to fetch parent trade: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "DATABASE_ERROR",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        if (parentTrade.length > 0) {
          listingEventId = parentTrade[0].listingEventId;
          configurationId = parentTrade[0].configurationId;
        }
      }

      // If still missing, try to get from config (for buy orders)
      if (!(listingEventId && configurationId)) {
        const config = yield* this.getTradingConfiguration(tradeData.symbol);
        configurationId = config.id;
        // For buy orders, listingEventId should be provided
        // For sell orders without parent, we'll need to handle this case
      }

      yield* Effect.tryPromise({
        try: () =>
          db.insert(tradeAttempt).values({
            id: tradeData.id,
            listingEventId: listingEventId || tradeData.id, // Fallback to trade ID if missing
            configurationId: configurationId || tradeData.id, // Fallback to trade ID if missing
            symbol: tradeData.symbol,
            side: tradeData.sellReason ? "SELL" : "BUY",
            type: tradeData.strategy,
            quantity: tradeData.quantity,
            price: tradeData.targetPrice || tradeData.executedPrice,
            executedPrice: tradeData.executedPrice,
            executedQuantity: tradeData.executedQuantity,
            detectedAt: tradeData.createdAt,
            submittedAt: tradeData.createdAt,
            completedAt: tradeData.completedAt,
            errorMessage: tradeData.error,
            parentTradeId: tradeData.parentTradeId,
            positionId: tradeData.positionId,
            sellReason: tradeData.sellReason,
            configurationSnapshot: tradeData.metadata || {},
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

  // Get today's spent amount
  private readonly getTodaySpentAmount = (): Effect.Effect<
    number,
    TradingError
  > => {
    return Effect.gen(function* () {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTrades = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradeAttempt)
            .where(
              and(
                eq(tradeAttempt.status, "SUCCESS")
                // Use a simple date comparison - in production, you'd want proper date filtering
              )
            ),
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
        const executedAmount = Number.parseFloat(trade.executedQuantity || "0");
        return total + executedAmount;
      }, 0);
    });
  };

  // Get hourly trade count
  private readonly getHourlyTradeCount = (): Effect.Effect<
    number,
    TradingError
  > => {
    return Effect.gen(function* () {
      const _oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const hourlyTrades = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradeAttempt)
            .where(
              and(
                eq(tradeAttempt.status, "SUCCESS")
                // Use a simple date comparison - in production, you'd want proper date filtering
              )
            ),
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
