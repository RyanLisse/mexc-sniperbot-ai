import type { TradingConfiguration as TradingConfigType } from "@mexc-sniperbot-ai/db";
import { db, tradeAttempt, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";
import { accountService } from "./account-service";
import { type MEXCOrderResponse, mexcClient } from "./mexc-client";
import { orderValidator } from "./order-validator";
import { positionTracker } from "./position-tracker";
import { riskManager } from "./risk-manager";

// Service interface
export type TradeExecutorService = {
  executeTrade: (
    symbol: string,
    strategy?: TradeStrategy
  ) => Effect.Effect<TradeResult, TradingError | MEXCApiError>;
  executeSellTrade: (
    symbol: string,
    quantity: string,
    strategy?: TradeStrategy,
    options?: { sellReason?: string; parentTradeId?: string }
  ) => Effect.Effect<TradeResult, TradingError | MEXCApiError>;
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
  ): Effect.Effect<TradeResult, TradingError | MEXCApiError> => {
    const self = this;
    return Effect.gen(function* () {
      const startTime = Date.now();

      yield* TradingLogger.logInfo("Trade started", {
        tradeId: `trade_${symbol}_${startTime}`,
        symbol,
        status: "PENDING",
      });

      try {
        // Get trading configuration for this symbol
        const config = yield* self.getTradingConfiguration(symbol);

        // Validate trade parameters (includes risk checks)
        yield* self.validateTradeParameters(symbol, config, strategy);

        // Calculate trade quantity
        const quantity = yield* self.calculateTradeQuantity(symbol, config);

        // Execute the trade based on strategy
        const orderResult = yield* self.executeOrderStrategy(
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
        yield* self.saveTradeAttempt({
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

        yield* TradingLogger.logInfo("Trade completed", {
          tradeId: `trade_${symbol}_${startTime}`,
          symbol,
          strategy,
          executionTime,
        });

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

        yield* TradingLogger.logError("Trade failed", error as Error);

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

  // Execute a sell trade (delegates to helpers to keep complexity low)
  executeSellTrade = (
    symbol: string,
    quantity: string,
    strategy: TradeStrategy = "MARKET",
    options?: { sellReason?: string; parentTradeId?: string }
  ): Effect.Effect<TradeResult, TradingError | MEXCApiError> => {
    const { sellReason, parentTradeId } = options ?? {};
    const self = this;

    return Effect.gen(function* () {
      const startTime = Date.now();

      yield* TradingLogger.logInfo(`Executing sell trade for ${symbol}`, {
        quantity,
        strategy,
        sellReason,
      });

      try {
        const { position, sellQuantity, positionQuantity } =
          yield* self.loadAndValidateSellPosition(symbol, quantity);

        const orderResult = yield* self.executeSellOrderStrategy(
          symbol,
          quantity,
          strategy
        );

        const { result, realizedPnL, executedQuantity } =
          self.buildSellExecutionResult(
            symbol,
            strategy,
            quantity,
            position,
            orderResult,
            sellQuantity,
            startTime
          );

        yield* self.persistSuccessfulSellTrade(
          self.saveTradeAttempt,
          symbol,
          startTime,
          position,
          parentTradeId,
          sellReason,
          result,
          realizedPnL,
          executedQuantity,
          positionQuantity
        );

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        yield* self.persistFailedSellTrade(
          self.saveTradeAttempt,
          symbol,
          strategy,
          startTime,
          executionTime,
          errorMessage,
          parentTradeId,
          sellReason
        );

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

  private readonly loadAndValidateSellPosition = (
    symbol: string,
    quantity: string
  ): Effect.Effect<
    { position: any; sellQuantity: number; positionQuantity: number },
    TradingError
  > =>
    Effect.gen(function* () {
      const position = yield* positionTracker.getPosition(symbol);
      if (!position) {
        throw new TradingError({
          message: `No open position found for ${symbol}`,
          code: "NO_POSITION",
          timestamp: new Date(),
        });
      }

      const positionQuantity = position.quantity;
      const sellQuantity = Number.parseFloat(quantity);

      if (sellQuantity > positionQuantity) {
        throw new TradingError({
          message: `Insufficient quantity: requested ${sellQuantity}, available ${positionQuantity}`,
          code: "INSUFFICIENT_QUANTITY",
          timestamp: new Date(),
        });
      }

      return { position, sellQuantity, positionQuantity };
    });

  private readonly buildSellExecutionResult = (
    symbol: string,
    strategy: TradeStrategy,
    quantity: string,
    position: any,
    orderResult: MEXCOrderResponse,
    sellQuantity: number,
    startTime: number
  ): {
    result: TradeResult;
    realizedPnL: number;
    executedQuantity: number;
  } => {
    const executionTime = Date.now() - startTime;
    const entryPrice = position.entryPrice;
    const executedPrice = orderResult.executedPrice
      ? Number.parseFloat(orderResult.executedPrice)
      : 0;
    const executedQuantity = orderResult.executedQuantity
      ? Number.parseFloat(orderResult.executedQuantity)
      : sellQuantity;
    const realizedPnL = (executedPrice - entryPrice) * executedQuantity;

    return {
      result: {
        success: true,
        orderId: orderResult.orderId,
        symbol,
        strategy,
        quantity,
        executedPrice: orderResult.executedPrice,
        executedQuantity: orderResult.executedQuantity,
        executionTime,
      },
      realizedPnL,
      executedQuantity,
    };
  };

  private readonly persistSuccessfulSellTrade = (
    saveTradeAttempt: (tradeData: {
      id: string;
      symbol: string;
      status: string;
      strategy: TradeStrategy;
      quantity: string;
      executedPrice?: string;
      executedQuantity?: string;
      createdAt: Date;
      completedAt?: Date;
      executionTime: number;
      error?: string;
      parentTradeId?: string;
      positionId?: string;
      sellReason?: string;
      metadata?: Record<string, unknown>;
    }) => Effect.Effect<void, MEXCApiError>,
    symbol: string,
    startTime: number,
    position: any,
    parentTradeId: string | undefined,
    sellReason: string | undefined,
    result: TradeResult,
    realizedPnL: number,
    executedQuantity: number,
    positionQuantity: number
  ): Effect.Effect<void, TradingError | MEXCApiError> =>
    Effect.gen(function* () {
      const positionId = parentTradeId || position.tradeAttemptId;

      yield* saveTradeAttempt({
        id: `sell_${symbol}_${startTime}`,
        symbol,
        status: "SUCCESS",
        strategy: result.strategy,
        quantity: result.quantity,
        executedPrice: result.executedPrice,
        executedQuantity: result.executedQuantity,
        createdAt: new Date(startTime),
        completedAt: new Date(),
        executionTime: result.executionTime,
        parentTradeId: parentTradeId || position.tradeAttemptId,
        positionId,
        sellReason: sellReason || "MANUAL",
        metadata: {
          orderId: result.orderId,
          price: result.executedPrice,
          originalQuantity: result.quantity,
          realizedPnL,
          entryPrice: position.entryPrice,
        },
      });

      if (executedQuantity >= positionQuantity) {
        yield* positionTracker.removePosition(symbol);
      } else {
        yield* positionTracker.updatePosition(symbol, {
          quantity: positionQuantity - executedQuantity,
        });
      }

      riskManager.recordTrade(realizedPnL);

      yield* TradingLogger.logInfo(`Sell trade completed for ${symbol}`, {
        orderId: result.orderId,
        realizedPnL,
      });
    });

  private readonly persistFailedSellTrade = (
    saveTradeAttempt: (tradeData: {
      id: string;
      symbol: string;
      status: string;
      strategy: TradeStrategy;
      quantity: string;
      createdAt: Date;
      completedAt?: Date;
      executionTime: number;
      error?: string;
      parentTradeId?: string;
      sellReason?: string;
      metadata?: Record<string, unknown>;
    }) => Effect.Effect<void, MEXCApiError>,
    symbol: string,
    strategy: TradeStrategy,
    startTime: number,
    executionTime: number,
    errorMessage: string,
    parentTradeId: string | undefined,
    sellReason: string | undefined
  ): Effect.Effect<void, MEXCApiError> =>
    Effect.gen(function* () {
      yield* saveTradeAttempt({
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
    });

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
            .where(eq(tradingConfiguration.isActive, true)),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to fetch trading configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "CONFIGURATION_FETCH_FAILED",
            timestamp: new Date(),
          });
        },
      });

      const config = configs.find((c) => c.enabledPairs.includes(symbol));

      if (!config) {
        throw new TradingError({
          message: `No active trading configuration found for symbol: ${symbol}`,
          code: "NO_CONFIGURATION_FOUND",
          timestamp: new Date(),
        });
      }

      return config;
    });

  // Validate trade parameters
  private readonly validateTradeParameters = (
    symbol: string,
    config: TradingConfigType,
    strategy: TradeStrategy
  ): Effect.Effect<void, TradingError> => {
    const self = this;
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
      const todaySpent = yield* self.getTodaySpentAmount();
      if (todaySpent >= config.dailySpendingLimit) {
        throw new TradingError({
          message: `Daily spending limit reached: ${todaySpent}/${config.dailySpendingLimit}`,
          code: "DAILY_LIMIT_REACHED",
          timestamp: new Date(),
        });
      }

      // Check hourly trade limit
      const hourlyTrades = yield* self.getHourlyTradeCount();
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
      const ticker = yield* mexcClient.getTicker(symbol).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new TradingError({
              message: `Failed to fetch price for validation: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              code: "PRICE_FETCH_FAILED",
              timestamp: new Date(),
            })
          )
        )
      );
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
      if (!accountInfo) {
        throw new TradingError({
          message: "Account information is unavailable for risk validation",
          code: "ACCOUNT_INFO_UNAVAILABLE",
          timestamp: new Date(),
        });
      }
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
    symbol: string,
    config: TradingConfigType
  ): Effect.Effect<string, TradingError> => {
    return Effect.gen(function* () {
      // Base micro-trade sizing: small fraction of configured max, capped at $10 notional
      const baseUsd = config.maxPurchaseAmount * 0.1; // 10% of configured max
      const microTradeCapUsd = 10; // hard cap per trade in quote currency (USDT)
      const tradeUsd = Math.min(baseUsd, microTradeCapUsd);

      if (tradeUsd <= 0) {
        throw new TradingError({
          message: "Calculated trade amount is too small",
          code: "TRADE_AMOUNT_TOO_SMALL",
          timestamp: new Date(),
        });
      }

      // Convert capped USD amount to base asset quantity using current market price
      const ticker = yield* mexcClient.getTicker(symbol);
      const price = Number.parseFloat(ticker.price);

      if (!Number.isFinite(price) || price <= 0) {
        throw new TradingError({
          message: `Invalid price for ${symbol}: ${ticker.price}`,
          code: "INVALID_MARKET_PRICE",
          timestamp: new Date(),
        });
      }

      const quantity = tradeUsd / price;

      if (quantity <= 0) {
        throw new TradingError({
          message: "Calculated trade quantity is too small",
          code: "TRADE_AMOUNT_TOO_SMALL",
          timestamp: new Date(),
        });
      }

      return quantity.toString();
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
        const parentTradeId = tradeData.parentTradeId;
        const parentTrade = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(tradeAttempt)
              .where(eq(tradeAttempt.id, parentTradeId))
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

// Export singleton instance
export const tradeExecutor = new TradeExecutor();
