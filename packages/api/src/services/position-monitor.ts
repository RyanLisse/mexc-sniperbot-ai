import type { TradingConfiguration } from "@mexc-sniperbot-ai/db";
import { db, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";
import { mexcClient } from "./mexc-client";
import { type Position, positionTracker } from "./position-tracker";

/**
 * Sell condition evaluation result
 */
export type SellConditionResult = {
  shouldSell: boolean;
  reason?: string;
  triggerPrice?: number;
};

/**
 * Position monitor service
 * Continuously monitors open positions and triggers sells when conditions are met
 */
export class PositionMonitor {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL_MS = 2000; // 2 seconds

  /**
   * Start background monitoring loop
   */
  startMonitoring = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      if (this.isMonitoring) {
        throw new TradingError({
          message: "Position monitoring is already running",
          code: "MONITOR_ALREADY_RUNNING",
          timestamp: new Date(),
        });
      }

      yield* TradingLogger.logInfo("Starting position monitoring");

      this.isMonitoring = true;

      // Start monitoring loop
      this.monitoringInterval = setInterval(async () => {
        if (this.isMonitoring) {
          try {
            await Effect.runPromise(
              this.checkAllPositions().pipe(
                Effect.catchAll((error) => {
                  TradingLogger.logError(
                    "Position monitoring cycle error",
                    error as Error
                  );
                  return Effect.void;
                })
              )
            );
          } catch (error) {
            TradingLogger.logError(
              "Position monitoring cycle error",
              error as Error
            );
          }
        }
      }, this.MONITORING_INTERVAL_MS);

      yield* TradingLogger.logInfo(
        `Position monitoring started (interval: ${this.MONITORING_INTERVAL_MS}ms)`
      );
    });
  };

  /**
   * Stop monitoring loop
   */
  stopMonitoring = (): Effect.Effect<void, TradingError> =>
    Effect.gen(function* () {
      if (!this.isMonitoring) {
        throw new TradingError({
          message: "Position monitoring is not running",
          code: "MONITOR_NOT_RUNNING",
          timestamp: new Date(),
        });
      }

      yield* TradingLogger.logInfo("Stopping position monitoring");

      this.isMonitoring = false;

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      yield* TradingLogger.logInfo("Position monitoring stopped");
    });

  /**
   * Check all open positions for sell conditions
   */
  checkAllPositions = (): Effect.Effect<
    number,
    MEXCApiError | TradingError
  > => {
    return Effect.gen(function* () {
      // Get open positions
      const positions = yield* positionTracker.getOpenPositions();

      if (positions.length === 0) {
        yield* TradingLogger.logDebug("No open positions to monitor");
        return 0;
      }

      yield* TradingLogger.logDebug(
        `Checking ${positions.length} open positions for sell conditions`
      );

      // Get active trading configuration
      const configs = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradingConfiguration)
            .where(eq(tradingConfiguration.isActive, true))
            .limit(1),
        catch: (error) => {
          throw new MEXCApiError({
            message: `Failed to fetch trading configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "DATABASE_ERROR",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });

      if (configs.length === 0) {
        yield* TradingLogger.logDebug(
          "No active trading configuration found, skipping position checks"
        );
        return 0;
      }

      const config = configs[0];
      let sellCount = 0;

      // Check each position
      for (const position of positions) {
        try {
          const sellCondition = yield* this.evaluateSellConditions(
            position,
            config
          );

          if (sellCondition.shouldSell) {
            yield* TradingLogger.logInfo(
              `Sell condition met for ${position.symbol}: ${sellCondition.reason}`,
              {
                entryPrice: position.entryPrice,
                currentPrice: position.currentPrice,
                unrealizedPnL: position.unrealizedPnL,
                triggerPrice: sellCondition.triggerPrice,
              }
            );

            // Trigger sell (this will be handled by trading orchestrator)
            yield* this.triggerSell(
              position,
              sellCondition.reason || "UNKNOWN"
            );

            sellCount += 1;
          }
        } catch (error) {
          yield* TradingLogger.logError(
            `Error checking position ${position.symbol}`,
            error as Error
          );
        }
      }

      if (sellCount > 0) {
        yield* TradingLogger.logInfo(
          `Triggered ${sellCount} sell orders from position monitoring`
        );
      }

      return sellCount;
    });
  };

  /**
   * Check if a specific position should be sold
   */
  checkPosition = (
    position: Position,
    config: TradingConfiguration
  ): Effect.Effect<SellConditionResult, MEXCApiError> =>
    this.evaluateSellConditions(position, config);

  /**
   * Evaluate all sell conditions for a position
   */
  evaluateSellConditions = (
    position: Position,
    config: TradingConfiguration
  ): Effect.Effect<SellConditionResult, MEXCApiError> => {
    return Effect.gen(function* () {
      const sellStrategy = config.sellStrategy || "COMBINED";
      const profitTargetPercent = config.profitTargetPercent || 500; // Default 5%
      const stopLossPercent = config.stopLossPercent || 200; // Default 2%
      const timeBasedExitMinutes = config.timeBasedExitMinutes || 60; // Default 60 minutes
      const trailingStopPercent = config.trailingStopPercent;

      // Update position with current price
      const ticker = yield* mexcClient.getTicker(position.symbol);
      const currentPrice = Number.parseFloat(ticker.price);
      yield* positionTracker.updatePosition(position.symbol, { currentPrice });

      // Recalculate PnL with updated price
      const updatedPosition = yield* positionTracker.getPosition(
        position.symbol
      );
      if (!updatedPosition) {
        return { shouldSell: false };
      }

      const entryPrice = updatedPosition.entryPrice;
      const unrealizedPnLPercent = updatedPosition.unrealizedPnLPercent;

      // Check profit target
      const profitTargetPrice = entryPrice * (1 + profitTargetPercent / 10_000);
      const profitTargetMet = currentPrice >= profitTargetPrice;

      // Check stop loss
      const stopLossPrice = entryPrice * (1 - stopLossPercent / 10_000);
      const stopLossTriggered = currentPrice <= stopLossPrice;

      // Check time-based exit
      const entryTime = updatedPosition.entryTime.getTime();
      const currentTime = Date.now();
      const timeBasedExitMs = timeBasedExitMinutes * 60 * 1000;
      const timeBasedExitMet = currentTime >= entryTime + timeBasedExitMs;

      // Evaluate based on sell strategy
      if (sellStrategy === "PROFIT_TARGET" && profitTargetMet) {
        return {
          shouldSell: true,
          reason: "PROFIT_TARGET",
          triggerPrice: profitTargetPrice,
        };
      }

      if (sellStrategy === "STOP_LOSS" && stopLossTriggered) {
        return {
          shouldSell: true,
          reason: "STOP_LOSS",
          triggerPrice: stopLossPrice,
        };
      }

      if (sellStrategy === "TIME_BASED" && timeBasedExitMet) {
        return {
          shouldSell: true,
          reason: "TIME_BASED",
        };
      }

      if (sellStrategy === "COMBINED") {
        // Combined strategy: sell if any condition is met
        if (profitTargetMet) {
          return {
            shouldSell: true,
            reason: "PROFIT_TARGET",
            triggerPrice: profitTargetPrice,
          };
        }

        if (stopLossTriggered) {
          return {
            shouldSell: true,
            reason: "STOP_LOSS",
            triggerPrice: stopLossPrice,
          };
        }

        if (timeBasedExitMet) {
          return {
            shouldSell: true,
            reason: "TIME_BASED",
          };
        }
      }

      // Trailing stop (if configured)
      if (trailingStopPercent && sellStrategy === "TRAILING_STOP") {
        // TODO: Implement trailing stop logic
        // This requires tracking the highest price reached since entry
        yield* TradingLogger.logDebug(
          "Trailing stop not yet implemented for position",
          { symbol: position.symbol }
        );
      }

      return { shouldSell: false };
    });
  };

  /**
   * Trigger sell order for a position
   * Note: This emits a signal that will be handled by the trading orchestrator
   */
  triggerSell = (
    position: Position,
    reason: string
  ): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Triggering sell for ${position.symbol}`, {
        reason,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        unrealizedPnL: position.unrealizedPnL,
      });

      // The actual sell execution will be handled by trading orchestrator
      // This method just logs the trigger and updates position state
      // The orchestrator will call tradeExecutor.executeSellTrade()
    });
  };

  /**
   * Get monitoring status
   */
  getStatus = (): { isMonitoring: boolean; intervalMs: number } => ({
    isMonitoring: this.isMonitoring,
    intervalMs: this.MONITORING_INTERVAL_MS,
  });
}

// Export singleton instance
export const positionMonitor = new PositionMonitor();
