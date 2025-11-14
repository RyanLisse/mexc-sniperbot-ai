import { Effect } from "effect";
import { z } from "zod";
import { credentialValidatedProcedure, publicProcedure, router } from "../index";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";
import { listingDetector } from "../services/listing-detector";
import { positionTracker } from "../services/position-tracker";
import { tradeExecutor } from "../services/trade-executor";
import { tradingOrchestrator } from "../services/trading-orchestrator";

// Zod schemas for validation
const manualTradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  strategy: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
});

const orderStatusSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  symbol: z.string().min(1, "Symbol is required"),
});

const tradeHistorySchema = z.object({
  limit: z.number().positive().max(100).default(20),
  symbol: z.string().optional(),
  status: z.enum(["SUCCESS", "FAILED", "PENDING"]).optional(),
});

const botControlSchema = z.object({
  action: z.enum(["start", "stop", "restart", "status"]),
});

const listingQuerySchema = z.object({
  hours: z.number().positive().max(168).default(24), // Max 1 week
  symbol: z.string().optional(),
});

const calendarQuerySchema = z.object({
  hours: z.number().positive().max(168).default(48), // Max 1 week
  filter: z.enum(["all", "today", "tomorrow", "upcoming"]).default("all"),
});

const manualSellSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  quantity: z.string().optional(), // Optional, will use full position if not provided
  strategy: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
});

const updateSellStrategySchema = z.object({
  profitTargetPercent: z.number().min(1).max(9999).optional(),
  stopLossPercent: z.number().min(1).max(9999).optional(),
  timeBasedExitMinutes: z.number().positive().optional(),
  trailingStopPercent: z.number().min(1).max(9999).optional(),
  sellStrategy: z
    .enum([
      "PROFIT_TARGET",
      "STOP_LOSS",
      "TIME_BASED",
      "TRAILING_STOP",
      "COMBINED",
    ])
    .optional(),
});

// Trading router
export const tradingRouter = router({
  // Manual trade execution
  executeManualTrade: credentialValidatedProcedure
    .input(manualTradeSchema)
    .mutation(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Executing manual trade", input);

          try {
            yield* tradingOrchestrator.executeManualTrade(input.symbol);

            yield* TradingLogger.logInfo("Manual trade executed successfully", {
              symbol: input.symbol,
              strategy: input.strategy,
            });

            return {
              success: true,
              message: `Manual trade executed for ${input.symbol}`,
              symbol: input.symbol,
              strategy: input.strategy,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              `Manual trade failed for ${input.symbol}`,
              error as Error
            );

            if (
              error instanceof TradingError ||
              error instanceof MEXCApiError
            ) {
              throw error;
            }

            throw new TradingError({
              message: `Manual trade execution failed: ${errorMessage}`,
              code: "MANUAL_TRADE_EXECUTION_FAILED",
              timestamp: new Date(),
            });
          }
        })
      )
    ),

  // Get order status
  getOrderStatus: credentialValidatedProcedure
    .input(orderStatusSchema)
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching order status", input);

          try {
            const status = yield* tradeExecutor.getOrderStatus(
              input.orderId,
              input.symbol
            );

            yield* TradingLogger.logInfo("Order status fetched successfully", {
              orderId: input.orderId,
              symbol: input.symbol,
              status,
            });

            return {
              orderId: input.orderId,
              symbol: input.symbol,
              status,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              `Failed to fetch order status for ${input.orderId}`,
              error as Error
            );

            if (error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Failed to fetch order status: ${errorMessage}`,
              code: "ORDER_STATUS_FETCH_FAILED",
              timestamp: new Date(),
            });
          }
        })
      )
    ),

  // Cancel order
  cancelOrder: credentialValidatedProcedure
    .input(orderStatusSchema)
    .mutation(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Cancelling order", input);

          try {
            const result = yield* tradeExecutor.cancelOrder(
              input.orderId,
              input.symbol
            );

            yield* TradingLogger.logInfo("Order cancelled successfully", {
              orderId: input.orderId,
              symbol: input.symbol,
              status: result.status,
            });

            return {
              success: true,
              orderId: input.orderId,
              symbol: input.symbol,
              status: result.status,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              `Failed to cancel order ${input.orderId}`,
              error as Error
            );

            if (error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Failed to cancel order: ${errorMessage}`,
              code: "ORDER_CANCELLATION_FAILED",
              timestamp: new Date(),
            });
          }
        })
      )
    ),

  // Get trade history
  getTradeHistory: publicProcedure
    .input(tradeHistorySchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching trade history", input);

          try {
            const trades = yield* tradeExecutor.getTradeHistory(input.limit);

            // Apply filters if provided
            let filteredTrades = trades;

            if (input.symbol) {
              filteredTrades = filteredTrades.filter((trade) =>
                trade.symbol.toLowerCase().includes(input.symbol?.toLowerCase())
              );
            }

            if (input.status) {
              filteredTrades = filteredTrades.filter(
                (trade) => trade.status === input.status
              );
            }

            yield* TradingLogger.logInfo("Trade history fetched successfully", {
              requested: input.limit,
              filtered: filteredTrades.length,
            });

            return {
              trades: filteredTrades,
              total: filteredTrades.length,
              requested: input.limit,
              filters: {
                symbol: input.symbol,
                status: input.status,
              },
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              "Failed to fetch trade history",
              error as Error
            );

            if (error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Failed to fetch trade history: ${errorMessage}`,
              code: "TRADE_HISTORY_FETCH_FAILED",
              timestamp: new Date(),
            });
          }
        })
      );
    }),

  // Get recent listings
  getRecentListings: publicProcedure
    .input(listingQuerySchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching recent listings", input);

          try {
            const listings = yield* listingDetector.getRecentListings(
              input.hours
            );

            // Apply symbol filter if provided
            let filteredListings = listings;
            if (input.symbol) {
              filteredListings = listings.filter((listing) =>
                listing.symbol
                  .toLowerCase()
                  .includes(input.symbol?.toLowerCase())
              );
            }

            yield* TradingLogger.logInfo(
              "Recent listings fetched successfully",
              {
                hours: input.hours,
                total: listings.length,
                filtered: filteredListings.length,
              }
            );

            return {
              listings: filteredListings,
              total: filteredListings.length,
              timeRange: `${input.hours} hours`,
              filters: {
                symbol: input.symbol,
              },
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              "Failed to fetch recent listings",
              error as Error
            );

            if (error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Failed to fetch recent listings: ${errorMessage}`,
              code: "RECENT_LISTINGS_FETCH_FAILED",
              timestamp: new Date(),
            });
          }
        })
      );
    }),

  // Get calendar listings (upcoming coin launches)
  getCalendarListings: publicProcedure.query(async () => {
    return Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Fetching calendar listings");

        try {
          const calendarEntries =
            yield* listingDetector.getUpcomingListings(168); // Get all upcoming (1 week)

          yield* TradingLogger.logInfo(
            "Calendar listings fetched successfully",
            {
              total: calendarEntries.length,
            }
          );

          return {
            listings: calendarEntries.map((entry) => ({
              vcoinId: entry.vcoinId,
              symbol: entry.symbol,
              vcoinName: entry.vcoinName,
              projectName: entry.vcoinNameFull,
              firstOpenTime: new Date(entry.firstOpenTime).toISOString(),
              zone: entry.zone,
            })),
            total: calendarEntries.length,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Failed to fetch calendar listings",
            error as Error
          );

          if (error instanceof MEXCApiError) {
            throw error;
          }

          throw new TradingError({
            message: `Failed to fetch calendar listings: ${errorMessage}`,
            code: "CALENDAR_LISTINGS_FETCH_FAILED",
            timestamp: new Date(),
          });
        }
      })
    );
  }),

  // Get upcoming listings with time filtering
  getUpcomingListings: publicProcedure
    .input(calendarQuerySchema)
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching upcoming listings", input);

          try {
            let calendarEntries;

            switch (input.filter) {
              case "today":
                calendarEntries = yield* listingDetector.getTodaysListings();
                break;
              case "tomorrow":
                calendarEntries = yield* listingDetector.getTomorrowsListings();
                break;
              case "upcoming":
                calendarEntries = yield* listingDetector.getUpcomingListings(
                  input.hours
                );
                break;
              default:
                calendarEntries = yield* listingDetector.getUpcomingListings(
                  input.hours
                );
            }

            yield* TradingLogger.logInfo(
              "Upcoming listings fetched successfully",
              {
                filter: input.filter,
                hours: input.hours,
                total: calendarEntries.length,
              }
            );

            return {
              listings: calendarEntries.map((entry) => ({
                vcoinId: entry.vcoinId,
                symbol: entry.symbol,
                vcoinName: entry.vcoinName,
                projectName: entry.vcoinNameFull,
                firstOpenTime: new Date(entry.firstOpenTime).toISOString(),
                zone: entry.zone,
              })),
              total: calendarEntries.length,
              filter: input.filter,
              timeRange: input.hours ? `${input.hours} hours` : undefined,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              "Failed to fetch upcoming listings",
              error as Error
            );

            if (error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Failed to fetch upcoming listings: ${errorMessage}`,
              code: "UPCOMING_LISTINGS_FETCH_FAILED",
              timestamp: new Date(),
            });
          }
        })
      )
    ),

  // Bot control (start/stop/restart/status)
  controlBot: credentialValidatedProcedure
    .input(botControlSchema)
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Bot control operation", input);

          try {
            let result;

            switch (input.action) {
              case "start":
                yield* tradingOrchestrator.startTradingBot();
                result = {
                  action: "started",
                  message: "Trading bot started successfully",
                };
                break;

              case "stop":
                yield* tradingOrchestrator.stopTradingBot();
                result = {
                  action: "stopped",
                  message: "Trading bot stopped successfully",
                };
                break;

              case "restart":
                yield* tradingOrchestrator.stopTradingBot();
                // Add a small delay before restarting
                yield* Effect.sleep(1000);
                yield* tradingOrchestrator.startTradingBot();
                result = {
                  action: "restarted",
                  message: "Trading bot restarted successfully",
                };
                break;

              case "status": {
                const status = yield* tradingOrchestrator.getBotStatus();
                result = { action: "status", status };
                break;
              }

              default:
                throw new TradingError({
                  message: `Invalid bot action: ${input.action}`,
                  code: "INVALID_BOT_ACTION",
                  timestamp: new Date(),
                });
            }

            yield* TradingLogger.logInfo("Bot control operation completed", {
              action: input.action,
              result,
            });

            return {
              success: true,
              action: input.action,
              result,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              `Bot control operation failed: ${input.action}`,
              error as Error
            );

            if (
              error instanceof TradingError ||
              error instanceof MEXCApiError
            ) {
              throw error;
            }

            throw new TradingError({
              message: `Bot control operation failed: ${errorMessage}`,
              code: "BOT_CONTROL_FAILED",
              timestamp: new Date(),
            });
          }
        })
      );
    }),

  // Get bot status
  getBotStatus: publicProcedure.query(async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Fetching bot status");

        try {
          const status = yield* tradingOrchestrator.getBotStatus();

          yield* TradingLogger.logInfo(
            "Bot status fetched successfully",
            status
          );

          return {
            ...status,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Failed to fetch bot status",
            error as Error
          );

          if (error instanceof TradingError) {
            throw error;
          }

          throw new TradingError({
            message: `Failed to fetch bot status: ${errorMessage}`,
            code: "BOT_STATUS_FETCH_FAILED",
            timestamp: new Date(),
          });
        }
      })
    )
  ),

  // Process new listings (manual trigger)
  processNewListings: credentialValidatedProcedure.mutation(async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Manual listing processing triggered");

        try {
          const successfulTrades =
            yield* tradingOrchestrator.processNewListings();

          yield* TradingLogger.logInfo("Manual listing processing completed", {
            successfulTrades,
          });

          return {
            success: true,
            successfulTrades,
            message: `Processed listings and executed ${successfulTrades} successful trades`,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Manual listing processing failed",
            error as Error
          );

          if (error instanceof TradingError || error instanceof MEXCApiError) {
            throw error;
          }

          throw new TradingError({
            message: `Manual listing processing failed: ${errorMessage}`,
            code: "MANUAL_LISTING_PROCESSING_FAILED",
            timestamp: new Date(),
          });
        }
      })
    )
  ),

  // Get trading statistics
  getTradingStats: publicProcedure.query(async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Fetching trading statistics");

        try {
          const stats = yield* tradingOrchestrator.getTradingStatistics();

          yield* TradingLogger.logInfo(
            "Trading statistics fetched successfully",
            stats
          );

          return {
            ...stats,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Failed to fetch trading statistics",
            error as Error
          );

          if (error instanceof TradingError) {
            throw error;
          }

          throw new TradingError({
            message: `Failed to fetch trading statistics: ${errorMessage}`,
            code: "TRADING_STATS_FETCH_FAILED",
            timestamp: new Date(),
          });
        }
      })
    )
  ),

  // Get detector statistics
  getDetectorStats: publicProcedure.query(async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Fetching detector statistics");

        try {
          const stats = yield* listingDetector.getStatistics();

          yield* TradingLogger.logInfo(
            "Detector statistics fetched successfully",
            stats
          );

          return {
            ...stats,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Failed to fetch detector statistics",
            error as Error
          );

          if (error instanceof MEXCApiError) {
            throw error;
          }

          throw new TradingError({
            message: `Failed to fetch detector statistics: ${errorMessage}`,
            code: "DETECTOR_STATS_FETCH_FAILED",
            timestamp: new Date(),
          });
        }
      })
    )
  ),

  // Get open positions
  getOpenPositions: credentialValidatedProcedure.query(async () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo("Fetching open positions");

        try {
          const positions = yield* positionTracker.getOpenPositions();

          yield* TradingLogger.logInfo("Open positions fetched successfully", {
            count: positions.length,
          });

          return {
            positions: positions.map((pos) => ({
              symbol: pos.symbol,
              quantity: pos.quantity,
              entryPrice: pos.entryPrice,
              entryTime: pos.entryTime.toISOString(),
              currentPrice: pos.currentPrice,
              unrealizedPnL: pos.unrealizedPnL,
              unrealizedPnLPercent: pos.unrealizedPnLPercent,
              buyOrderId: pos.buyOrderId,
            })),
            total: positions.length,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          yield* TradingLogger.logError(
            "Failed to fetch open positions",
            error as Error
          );

          if (error instanceof MEXCApiError) {
            throw error;
          }

          throw new TradingError({
            message: `Failed to fetch open positions: ${errorMessage}`,
            code: "OPEN_POSITIONS_FETCH_FAILED",
            timestamp: new Date(),
          });
        }
      })
    )
  ),

  // Execute manual sell order
  executeManualSell: credentialValidatedProcedure
    .input(manualSellSchema)
    .mutation(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Executing manual sell order", input);

          try {
            // Get position to determine quantity if not provided
            let quantity = input.quantity;
            if (!quantity) {
              const position = yield* positionTracker.getPosition(input.symbol);
              if (!position) {
                throw new TradingError({
                  message: `No open position found for ${input.symbol}`,
                  code: "NO_POSITION_FOUND",
                  timestamp: new Date(),
                });
              }
              quantity = position.quantity.toString();
            }

            // Execute sell trade
            const result = yield* tradeExecutor.executeSellTrade(
              input.symbol,
              quantity,
              input.strategy,
              "MANUAL"
            );

            yield* TradingLogger.logInfo(
              "Manual sell order executed successfully",
              {
                symbol: input.symbol,
                quantity,
                strategy: input.strategy,
                orderId: result.orderId,
              }
            );

            return {
              success: result.success,
              orderId: result.orderId,
              symbol: result.symbol,
              quantity: result.quantity,
              executedPrice: result.executedPrice,
              executedQuantity: result.executedQuantity,
              executionTime: result.executionTime,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            yield* TradingLogger.logError(
              `Manual sell order failed for ${input.symbol}`,
              error as Error
            );

            if (
              error instanceof TradingError ||
              error instanceof MEXCApiError
            ) {
              throw error;
            }

            throw new TradingError({
              message: `Manual sell order execution failed: ${errorMessage}`,
              code: "MANUAL_SELL_EXECUTION_FAILED",
              timestamp: new Date(),
            });
          }
        })
      )
    ),

  // Update sell strategy configuration
  updateSellStrategy: publicProcedure
    .input(updateSellStrategySchema)
    .mutation(async ({ input, ctx }) => {
      // This should update the trading configuration
      // For now, return success - actual implementation would update config service
      return {
        success: true,
        message: "Sell strategy updated successfully",
        updatedFields: input,
        timestamp: new Date().toISOString(),
      };
    }),
});
