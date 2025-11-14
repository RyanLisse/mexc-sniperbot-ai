import {
  botStatus,
  db,
  listingEvent,
  tradingConfiguration,
} from "@mexc-sniperbot-ai/db";
import { and, desc, eq, lte } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import {
  type BotStatus,
  MEXCApiError,
  TradingError,
  TradingLogger,
} from "../lib/effect";
import { getMastraInstance } from "../lib/mastra-config";
import { accountService } from "./account-service";
import { listingDetector } from "./listing-detector";
import { mexcClient } from "./mexc-client";
import { positionMonitor } from "./position-monitor";
import { positionTracker } from "./position-tracker";
import { retryService } from "./retry-service";
import { riskManager } from "./risk-manager";
import { tradeExecutor } from "./trade-executor";

// Service interface for dependency injection
export type TradingOrchestratorService = {
  startTradingBot: () => Effect.Effect<void, TradingError | MEXCApiError>;
  stopTradingBot: () => Effect.Effect<void, TradingError>;
  getBotStatus: () => Effect.Effect<BotStatus, TradingError>;
  executeManualTrade: (
    symbol: string
  ) => Effect.Effect<void, TradingError | MEXCApiError>;
  processNewListings: () => Effect.Effect<number, TradingError | MEXCApiError>;
};

// Service tag
export const TradingOrchestratorService =
  Context.Tag<TradingOrchestratorService>("TradingOrchestratorService");

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
    // Stop position monitoring interval if it exists
    const state = this as { positionMonitoringInterval?: NodeJS.Timeout };
    if (state.positionMonitoringInterval) {
      clearInterval(state.positionMonitoringInterval);
      state.positionMonitoringInterval = undefined;
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
  private readonly POLLING_INTERVAL_MS = 5000; // 5 seconds

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
        // Stop position monitoring
        if (positionMonitor.getStatus().isMonitoring) {
          yield* positionMonitor.stopMonitoring();
        }

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
        const _apiTest = yield* Effect.tryPromise({
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
  executeManualTrade = (
    symbol: string
  ): Effect.Effect<void, TradingError | MEXCApiError> => {
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
        // For manual trades, allow trading even if symbol is not in enabled pairs
        // This allows users to manually trade any symbol
        // Check if symbol is enabled, but don't block if it's not
        const isEnabled = yield* listingDetector.isSymbolEnabled(symbol);
        if (!isEnabled) {
          yield* TradingLogger.logInfo(
            `Symbol ${symbol} is not in enabled pairs, but proceeding with manual trade`
          );
        }

        // Execute the trade
        const result = yield* tradeExecutor.executeTrade(symbol, "MARKET");

        if (result.success) {
          yield* TradingLogger.logInfo(
            `Manual trade executed successfully for ${symbol}`,
            {
              orderId: result.orderId,
              executedPrice: result.executedPrice,
              executionTime: result.executionTime,
            }
          );
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

  // Get ready calendar listings (firstOpenTime has passed or is very soon)
  private getReadyCalendarListings = (): Effect.Effect<
    string[],
    MEXCApiError
  > => {
    return Effect.gen(function* () {
      const now = Date.now();
      const soonThreshold = 5000; // 5 seconds buffer

      try {
        const readyListings = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(listingEvent)
              .where(
                and(
                  eq(listingEvent.detectionMethod, "CALENDAR"),
                  eq(listingEvent.processed, false),
                  lte(listingEvent.listingTime, new Date(now + soonThreshold))
                )
              )
              .orderBy(desc(listingEvent.listingTime))
              .limit(50),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to fetch ready calendar listings: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "DATABASE_ERROR",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        return readyListings.map((listing) => listing.symbol);
      } catch (error) {
        yield* TradingLogger.logDebug(
          "Failed to get ready calendar listings, continuing with regular detection"
        );
        return [];
      }
    });
  };

  // Process new listings (main trading logic)
  processNewListings = (): Effect.Effect<
    number,
    TradingError | MEXCApiError
  > => {
    return Effect.gen(function* () {
      if (!this.botState.getStatus().isRunning) {
        return 0; // Bot is not running, no processing
      }

      const startTime = Date.now();

      try {
        yield* TradingLogger.logDebug("Processing new listings");

        // Detect new listings (calendar API first, then symbol comparison)
        const newListings = yield* listingDetector.detectNewListings();

        // Also check for calendar listings that are now ready to trade
        const readyCalendarListings = yield* this.getReadyCalendarListings();

        // Combine both sources, removing duplicates
        const allListings = Array.from(
          new Set([...newListings, ...readyCalendarListings])
        );

        if (allListings.length === 0) {
          yield* TradingLogger.logDebug("No new listings to process");
          return 0;
        }

        yield* TradingLogger.logInfo(
          `Processing ${allListings.length} new listings (${newListings.length} detected, ${readyCalendarListings.length} ready calendar)`
        );

        let successfulTrades = 0;

        // Process each new listing
        for (const symbol of allListings) {
          try {
            // Check if symbol is enabled for trading
            const isEnabled = yield* listingDetector.isSymbolEnabled(symbol);
            if (!isEnabled) {
              yield* TradingLogger.logDebug(
                `Skipping ${symbol}: not enabled for trading`
              );
              continue;
            }

            // Execute trade using Mastra workflow for deterministic execution with state snapshots
            // Fallback to direct execution if Mastra workflow fails
            let tradeResult;
            try {
              const mastra = getMastraInstance();
              const workflow = mastra.getWorkflow("order-execution");
              const run = workflow.createRun();

              // Get portfolio info for workflow
              const accountInfo = yield* accountService.getAccountInfo();
              const ticker = yield* mexcClient.getTicker(symbol);
              const price = Number.parseFloat(ticker.price);

              // Start workflow execution
              const workflowResult = yield* Effect.tryPromise({
                try: () =>
                  run.start({
                    inputData: {
                      symbol,
                      side: "buy",
                      quantity: 0.01, // Will be calculated by workflow
                      price,
                      orderType: "market",
                      portfolioValue: accountInfo.totalUsdValue,
                      dailyPnL: riskManager.getDailyPnL(),
                    },
                  }),
                catch: (error) =>
                  new TradingError({
                    message: `Mastra workflow failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    code: "MASTRA_WORKFLOW_FAILED",
                    timestamp: new Date(),
                  }),
              });

              // Convert workflow result to trade result format
              tradeResult = {
                success: workflowResult.confirmed === true,
                result: workflowResult.confirmed
                  ? {
                      orderId: workflowResult.orderId ?? "",
                      symbol,
                      strategy: "MARKET" as const,
                      quantity: "0.01",
                      executedPrice: workflowResult.executedPrice?.toString(),
                      executedQuantity: workflowResult.executedQty?.toString(),
                      executionTime: workflowResult.executionTime ?? 0,
                    }
                  : undefined,
                error: workflowResult.confirmed
                  ? undefined
                  : { message: "Workflow execution failed" },
              };
            } catch (workflowError) {
              // Fallback to direct trade execution if Mastra workflow fails
              yield* TradingLogger.logWarning(
                `Mastra workflow failed for ${symbol}, falling back to direct execution`,
                { error: workflowError }
              );

              tradeResult = yield* retryService.executeWithRetry(
                tradeExecutor.executeTrade(symbol, "MARKET"),
                `trade_${symbol}`,
                {
                  maxRetries: 2,
                  baseDelayMs: 500,
                  maxDelayMs: 2000,
                  backoffMultiplier: 2,
                  jitter: true,
                }
              );
            }

            if (tradeResult.success) {
              successfulTrades += 1;

              // Add position to position tracker after successful buy
              if (tradeResult.result) {
                yield* positionTracker.addPosition({
                  symbol,
                  orderId: tradeResult.result.orderId || "",
                  executedPrice: tradeResult.result.executedPrice || "0",
                  executedQuantity: tradeResult.result.executedQuantity || "0",
                  tradeAttemptId: `trade_${symbol}_${startTime}`,
                  createdAt: new Date(),
                });
              }

              // Mark calendar listing as processed if it exists
              yield* Effect.tryPromise({
                try: () =>
                  db
                    .update(listingEvent)
                    .set({ processed: true })
                    .where(
                      and(
                        eq(listingEvent.symbol, symbol),
                        eq(listingEvent.detectionMethod, "CALENDAR"),
                        eq(listingEvent.processed, false)
                      )
                    ),
                catch: () => {
                  // Ignore errors when marking as processed
                },
              });

              yield* TradingLogger.logInfo(
                `Successfully executed trade for ${symbol}`,
                {
                  executedPrice: tradeResult.result?.executedPrice,
                  executionTime: tradeResult.result?.executionTime,
                }
              );
            } else {
              yield* TradingLogger.logError(
                `Trade failed for ${symbol}`,
                new Error(tradeResult.error?.message || "Unknown error")
              );
            }
          } catch (error) {
            yield* TradingLogger.logError(
              `Error processing listing ${symbol}`,
              error as Error
            );
          }
        }

        const processingTime = Date.now() - startTime;

        yield* TradingLogger.logInfo("Completed listing processing", {
          totalListings: newListings.length,
          successfulTrades,
          processingTime,
        });

        return successfulTrades;
      } catch (error) {
        const processingTime = Date.now() - startTime;

        yield* TradingLogger.logError(
          `Listing processing failed after ${processingTime}ms`,
          error as Error
        );

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

  // Process position monitoring (check for sell conditions and execute sells)
  processPositionMonitoring = (): Effect.Effect<
    number,
    TradingError | MEXCApiError
  > => {
    return Effect.gen(function* () {
      if (!this.botState.getStatus().isRunning) {
        return 0; // Bot is not running, no processing
      }

      try {
        // Get open positions
        const positions = yield* positionTracker.getOpenPositions();

        if (positions.length === 0) {
          return 0; // No positions to monitor
        }

        // Get active trading configuration for sell strategy
        const configs = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.isActive, true))
              .limit(1),
          catch: (error) => {
            throw new TradingError({
              message: `Failed to fetch trading configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "CONFIG_FETCH_FAILED",
              timestamp: new Date(),
            });
          },
        });

        if (configs.length === 0) {
          yield* TradingLogger.logDebug(
            "No active trading configuration found, skipping position monitoring"
          );
          return 0;
        }

        const config = configs[0];
        let sellCount = 0;

        // Check each position for sell conditions
        for (const position of positions) {
          try {
            const sellCondition = yield* positionMonitor.checkPosition(
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
                }
              );

              // Execute sell trade
              const sellResult = yield* tradeExecutor.executeSellTrade(
                position.symbol,
                position.quantity.toString(),
                "MARKET",
                sellCondition.reason,
                position.tradeAttemptId
              );

              if (sellResult.success) {
                sellCount += 1;
                yield* TradingLogger.logInfo(
                  `Successfully executed sell for ${position.symbol}`,
                  {
                    reason: sellCondition.reason,
                    executedPrice: sellResult.executedPrice,
                  }
                );
              } else {
                yield* TradingLogger.logError(
                  `Failed to execute sell for ${position.symbol}`,
                  new Error(sellResult.error || "Unknown error")
                );
              }
            }
          } catch (error) {
            yield* TradingLogger.logError(
              `Error processing position ${position.symbol}`,
              error as Error
            );
          }
        }

        return sellCount;
      } catch (error) {
        if (error instanceof TradingError || error instanceof MEXCApiError) {
          throw error;
        }

        throw new TradingError({
          message: `Position monitoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "POSITION_MONITORING_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Private helper methods

  // Start background processing loop
  private readonly startBackgroundProcessing = (): void => {
    this.botState.processingInterval = setInterval(async () => {
      if (this.botState.getStatus().isRunning) {
        try {
          // Run the processing in the background
          Effect.runPromise(
            this.processNewListings().pipe(
              Effect.catchAll((error) => {
                TradingLogger.logError(
                  "Background processing error",
                  error as Error
                );
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
  private readonly updateBotStatusInDatabase = (): Effect.Effect<
    void,
    TradingError
  > =>
    Effect.gen(function* () {
      const status = this.botState.getStatus();

      yield* Effect.tryPromise({
        try: () =>
          db
            .insert(botStatus)
            .values({
              id: `bot_status_${Date.now()}`,
              isRunning: status.isRunning,
              lastHeartbeat: status.lastHeartbeat,
              mexcApiStatus: status.mexcApiStatus,
              apiResponseTime: status.apiResponseTime,
              metadata: {
                orchestratorVersion: "1.0.0",
                pollingInterval: this.POLLING_INTERVAL_MS,
              },
            })
            .onConflictDoUpdate({
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

  // Get trading statistics
  getTradingStatistics = (): Effect.Effect<
    {
      totalTrades: number;
      successfulTrades: number;
      failedTrades: number;
      successRate: number;
      averageExecutionTime: number;
    },
    TradingError
  > =>
    Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
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

      const successfulTrades = trades.filter(
        (t) => t.status === "SUCCESS"
      ).length;
      const failedTrades = trades.filter((t) => t.status === "FAILED").length;
      const totalTrades = trades.length;

      const averageExecutionTime =
        totalTrades > 0
          ? trades.reduce((sum, t) => sum + (t.executionTimeMs || 0), 0) /
            totalTrades
          : 0;

      return {
        totalTrades,
        successfulTrades,
        failedTrades,
        successRate:
          totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        averageExecutionTime,
      };
    });
}

// Create layer for dependency injection
export const TradingOrchestratorLive = Layer.succeed(
  TradingOrchestratorService,
  new TradingOrchestrator()
);

// Export singleton instance
export const tradingOrchestrator = new TradingOrchestrator();
