import { Effect, Layer, Context } from "effect";
import { listingDetector, type ListingDetectorService } from "./listing-detector";
import { tradeExecutor, type TradeExecutorService } from "./trade-executor";
import { retryService, type RetryService } from "./retry-service";
import { MEXCApiError, TradingError, TradingLogger, BotStatus } from "../lib/effect";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, and, desc } from "drizzle-orm";
import { botStatus, tradingConfiguration } from "@mexc-sniperbot-ai/db";

// Service interface for dependency injection
export interface TradingOrchestratorService {
  startTradingBot: () => Effect.Effect<void, TradingError | MEXCApiError>;
  stopTradingBot: () => Effect.Effect<void, TradingError>;
  getBotStatus: () => Effect.Effect<BotStatus, TradingError>;
  executeManualTrade: (symbol: string) => Effect.Effect<void, TradingError | MEXCApiError>;
  processNewListings: () => Effect.Effect<number, TradingError | MEXCApiError>;
}

// Service tag
export const TradingOrchestratorService = Context.Tag<TradingOrchestratorService>("TradingOrchestratorService");

// Bot state management
class BotStateManager {
  private isRunning = false;
  private lastHeartbeat = new Date();
  private processingInterval: NodeJS.Timeout | null = null;
  private mexcApiStatus = "UNKNOWN";
  private apiResponseTime = 0;

  start(): void {
    this.isRunning = true;
    this.lastHeartbeat = new Date();
  }

  stop(): void {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  updateHeartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  setApiStatus(status: string, responseTime?: number): void {
    this.mexcApiStatus = status;
    if (responseTime !== undefined) {
      this.apiResponseTime = responseTime;
    }
  }

  getStatus(): BotStatus {
    return {
      isRunning: this.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      mexcApiStatus: this.mexcApiStatus,
      apiResponseTime: this.apiResponseTime,
    };
  }
}

// Implementation class
export class TradingOrchestrator implements TradingOrchestratorService {
  private readonly botState = new BotStateManager();
  private readonly POLLING_INTERVAL_MS = 5_000; // 5 seconds

  // Start the trading bot
  startTradingBot = (): Effect.Effect<void, TradingError | MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Starting trading bot");

      if (this.botState.getStatus().isRunning) {
        throw new TradingError({
          message: "Trading bot is already running",
          code: "BOT_ALREADY_RUNNING",
          timestamp: new Date(),
        });
      }

      try {
        // Initialize the listing detector
        yield* listingDetector.initialize();

        // Start the bot
        this.botState.start();

        // Update bot status in database
        yield* this.updateBotStatusInDatabase();

        // Start the background processing loop
        this.startBackgroundProcessing();

        yield* TradingLogger.logInfo("Trading bot started successfully");
      } catch (error) {
        // Stop the bot if initialization failed
        this.botState.stop();
        throw error instanceof TradingError || error instanceof MEXCApiError 
          ? error 
          : new TradingError({
              message: `Failed to start trading bot: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "BOT_START_FAILED",
              timestamp: new Date(),
            });
      }
    });
  };

  // Stop the trading bot
  stopTradingBot = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Stopping trading bot");

      if (!this.botState.getStatus().isRunning) {
        throw new TradingError({
          message: "Trading bot is not running",
          code: "BOT_NOT_RUNNING",
          timestamp: new Date(),
        });
      }

      try {
        // Stop the bot
        this.botState.stop();

        // Update bot status in database
        yield* this.updateBotStatusInDatabase();

        yield* TradingLogger.logInfo("Trading bot stopped successfully");
      } catch (error) {
        throw new TradingError({
          message: `Failed to stop trading bot: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "BOT_STOP_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get current bot status
  getBotStatus = (): Effect.Effect<BotStatus, TradingError> => {
    return Effect.gen(function* () {
      try {
        const status = this.botState.getStatus();
        
        // Update heartbeat
        this.botState.updateHeartbeat();

        // Test API connectivity
        const apiTest = yield* Effect.tryPromise({
          try: () => mexcClient.getServerTime(),
          catch: (error) => {
            this.botState.setApiStatus("ERROR");
            throw new TradingError({
              message: `API connectivity test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "API_CONNECTIVITY_FAILED",
              timestamp: new Date(),
            });
          },
        });

        this.botState.setApiStatus("HEALTHY", 100); // Mock response time

        return status;
      } catch (error) {
        if (error instanceof TradingError) {
          throw error;
        }
        
        throw new TradingError({
          message: `Failed to get bot status: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "BOT_STATUS_FETCH_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Execute a manual trade
  executeManualTrade = (symbol: string): Effect.Effect<void, TradingError | MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Executing manual trade for ${symbol}`);

      if (!this.botState.getStatus().isRunning) {
        throw new TradingError({
          message: "Cannot execute trade: bot is not running",
          code: "BOT_NOT_RUNNING",
          timestamp: new Date(),
        });
      }

      try {
        // Check if symbol is enabled for trading
        const isEnabled = yield* listingDetector.isSymbolEnabled(symbol);
        if (!isEnabled) {
          throw new TradingError({
            message: `Symbol ${symbol} is not enabled for trading`,
            code: "SYMBOL_NOT_ENABLED",
            timestamp: new Date(),
          });
        }

        // Execute the trade
        const result = yield* tradeExecutor.executeTrade(symbol, "MARKET");

        if (result.success) {
          yield* TradingLogger.logInfo(`Manual trade executed successfully for ${symbol}`, {
            orderId: result.orderId,
            executedPrice: result.executedPrice,
            executionTime: result.executionTime,
          });
        } else {
          throw new TradingError({
            message: `Manual trade failed for ${symbol}: ${result.error}`,
            code: "MANUAL_TRADE_FAILED",
            timestamp: new Date(),
          });
        }
      } catch (error) {
        if (error instanceof TradingError || error instanceof MEXCApiError) {
          throw error;
        }
        
        throw new TradingError({
          message: `Manual trade execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "MANUAL_TRADE_EXECUTION_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Process new listings (main trading logic)
  processNewListings = (): Effect.Effect<number, TradingError | MEXCApiError> => {
    return Effect.gen(function* () {
      if (!this.botState.getStatus().isRunning) {
        return 0; // Bot is not running, no processing
      }

      const startTime = Date.now();
      
      try {
        yield* TradingLogger.logDebug("Processing new listings");

        // Detect new listings
        const newListings = yield* listingDetector.detectNewListings();

        if (newListings.length === 0) {
          yield* TradingLogger.logDebug("No new listings to process");
          return 0;
        }

        yield* TradingLogger.logInfo(`Processing ${newListings.length} new listings`);

        let successfulTrades = 0;

        // Process each new listing
        for (const symbol of newListings) {
          try {
            // Check if symbol is enabled for trading
            const isEnabled = yield* listingDetector.isSymbolEnabled(symbol);
            if (!isEnabled) {
              yield* TradingLogger.logDebug(`Skipping ${symbol}: not enabled for trading`);
              continue;
            }

            // Execute trade with retry logic
            const tradeResult = yield* retryService.executeWithRetry(
              tradeExecutor.executeTrade(symbol, "MARKET"),
              `trade_${symbol}`,
              {
                maxRetries: 2,
                baseDelayMs: 500,
                maxDelayMs: 2_000,
                backoffMultiplier: 2,
                jitter: true,
              }
            );

            if (tradeResult.success) {
              successfulTrades += 1;
              yield* TradingLogger.logInfo(`Successfully executed trade for ${symbol}`, {
                executedPrice: tradeResult.result?.executedPrice,
                executionTime: tradeResult.result?.executionTime,
              });
            } else {
              yield* TradingLogger.logError(`Trade failed for ${symbol}`, new Error(tradeResult.error?.message || "Unknown error"));
            }
          } catch (error) {
            yield* TradingLogger.logError(`Error processing listing ${symbol}`, error as Error);
          }
        }

        const processingTime = Date.now() - startTime;
        
        yield* TradingLogger.logInfo(`Completed listing processing`, {
          totalListings: newListings.length,
          successfulTrades,
          processingTime,
        });

        return successfulTrades;
      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        yield* TradingLogger.logError(`Listing processing failed after ${processingTime}ms`, error as Error);
        
        if (error instanceof TradingError || error instanceof MEXCApiError) {
          throw error;
        }
        
        throw new TradingError({
          message: `Listing processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "LISTING_PROCESSING_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Private helper methods

  // Start background processing loop
  private startBackgroundProcessing = (): void => {
    this.botState.processingInterval = setInterval(async () => {
      if (this.botState.getStatus().isRunning) {
        try {
          // Run the processing in the background
          Effect.runPromise(
            this.processNewListings().pipe(
              Effect.catchAll((error) => {
                TradingLogger.logError("Background processing error", error as Error);
                return Effect.void;
              })
            )
          );
        } catch (error) {
          TradingLogger.logError("Background processing error", error as Error);
        }
      }
    }, this.POLLING_INTERVAL_MS);
  };

  // Update bot status in database
  private updateBotStatusInDatabase = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      const status = this.botState.getStatus();
      
      yield* Effect.tryPromise({
        try: () => db.insert(botStatus).values({
          id: `bot_status_${Date.now()}`,
          isRunning: status.isRunning,
          lastHeartbeat: status.lastHeartbeat,
          mexcApiStatus: status.mexcApiStatus,
          apiResponseTime: status.apiResponseTime,
          metadata: {
            orchestratorVersion: "1.0.0",
            pollingInterval: this.POLLING_INTERVAL_MS,
          },
        }).onConflictDoUpdate({
          target: botStatus.id,
          set: {
            isRunning: status.isRunning,
            lastHeartbeat: status.lastHeartbeat,
            mexcApiStatus: status.mexcApiStatus,
            apiResponseTime: status.apiResponseTime,
            updatedAt: new Date(),
          },
        }),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to update bot status in database: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "BOT_STATUS_UPDATE_FAILED",
            timestamp: new Date(),
          });
        },
      });
    });
  };

  // Get trading statistics
  getTradingStatistics = (): Effect.Effect<{
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    averageExecutionTime: number;
  }, TradingError> => {
    return Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: () => db.select()
          .from(tradeAttempt)
          .orderBy(desc(tradeAttempt.createdAt))
          .limit(1000),
        catch: (error) => {
          throw new TradingError({
            message: `Failed to fetch trading statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "STATISTICS_FETCH_FAILED",
            timestamp: new Date(),
          });
        },
      });

      const successfulTrades = trades.filter(t => t.status === "SUCCESS").length;
      const failedTrades = trades.filter(t => t.status === "FAILED").length;
      const totalTrades = trades.length;

      const averageExecutionTime = totalTrades > 0
        ? trades.reduce((sum, t) => sum + (t.executionTimeMs || 0), 0) / totalTrades
        : 0;

      return {
        totalTrades,
        successfulTrades,
        failedTrades,
        successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        averageExecutionTime,
      };
    });
  };
}

// Create layer for dependency injection
export const TradingOrchestratorLive = Layer.succeed(
  TradingOrchestratorService,
  new TradingOrchestrator()
);

// Export singleton instance
export const tradingOrchestrator = new TradingOrchestrator();
