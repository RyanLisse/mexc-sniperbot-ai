import { router, protectedProcedure, publicProcedure } from "../index";
import { Effect } from "effect";
import { z } from "zod";
import { tradingOrchestrator, type TradingOrchestratorService } from "../services/trading-orchestrator";
import { tradeExecutor, type TradeExecutorService } from "../services/trade-executor";
import { listingDetector, type ListingDetectorService } from "../services/listing-detector";
import { retryService } from "../services/retry-service";
import { TradingError, MEXCApiError, TradingLogger } from "../lib/effect";
import type { TradeResult, OrderStatus, TradeHistoryItem } from "../services/trade-executor";

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

// Trading router
export const tradingRouter = router({
  // Manual trade execution
  executeManualTrade: protectedProcedure
    .input(manualTradeSchema)
    .mutation(async ({ input }) => {
      return Effect.runPromise(
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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError(`Manual trade failed for ${input.symbol}`, error as Error);

            if (error instanceof TradingError || error instanceof MEXCApiError) {
              throw error;
            }

            throw new TradingError({
              message: `Manual trade execution failed: ${errorMessage}`,
              code: "MANUAL_TRADE_EXECUTION_FAILED",
              timestamp: new Date(),
            });
          }
        })
      );
    }),

  // Get order status
  getOrderStatus: protectedProcedure
    .input(orderStatusSchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching order status", input);

          try {
            const status = yield* tradeExecutor.getOrderStatus(input.orderId, input.symbol);

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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError(`Failed to fetch order status for ${input.orderId}`, error as Error);

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
      );
    }),

  // Cancel order
  cancelOrder: protectedProcedure
    .input(orderStatusSchema)
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Cancelling order", input);

          try {
            const result = yield* tradeExecutor.cancelOrder(input.orderId, input.symbol);

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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError(`Failed to cancel order ${input.orderId}`, error as Error);

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
      );
    }),

  // Get trade history
  getTradeHistory: protectedProcedure
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
              filteredTrades = filteredTrades.filter(trade => 
                trade.symbol.toLowerCase().includes(input.symbol!.toLowerCase())
              );
            }

            if (input.status) {
              filteredTrades = filteredTrades.filter(trade => trade.status === input.status);
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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Failed to fetch trade history", error as Error);

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
  getRecentListings: protectedProcedure
    .input(listingQuerySchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching recent listings", input);

          try {
            const listings = yield* listingDetector.getRecentListings(input.hours);

            // Apply symbol filter if provided
            let filteredListings = listings;
            if (input.symbol) {
              filteredListings = listings.filter(listing =>
                listing.symbol.toLowerCase().includes(input.symbol!.toLowerCase())
              );
            }

            yield* TradingLogger.logInfo("Recent listings fetched successfully", {
              hours: input.hours,
              total: listings.length,
              filtered: filteredListings.length,
            });

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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Failed to fetch recent listings", error as Error);

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

  // Bot control (start/stop/restart/status)
  controlBot: protectedProcedure
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
                result = { action: "started", message: "Trading bot started successfully" };
                break;

              case "stop":
                yield* tradingOrchestrator.stopTradingBot();
                result = { action: "stopped", message: "Trading bot stopped successfully" };
                break;

              case "restart":
                yield* tradingOrchestrator.stopTradingBot();
                // Add a small delay before restarting
                yield* Effect.sleep(1_000);
                yield* tradingOrchestrator.startTradingBot();
                result = { action: "restarted", message: "Trading bot restarted successfully" };
                break;

              case "status":
                const status = yield* tradingOrchestrator.getBotStatus();
                result = { action: "status", status };
                break;

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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError(`Bot control operation failed: ${input.action}`, error as Error);

            if (error instanceof TradingError || error instanceof MEXCApiError) {
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
  getBotStatus: protectedProcedure
    .query(async () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching bot status");

          try {
            const status = yield* tradingOrchestrator.getBotStatus();

            yield* TradingLogger.logInfo("Bot status fetched successfully", status);

            return {
              ...status,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Failed to fetch bot status", error as Error);

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
      );
    }),

  // Process new listings (manual trigger)
  processNewListings: protectedProcedure
    .mutation(async () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Manual listing processing triggered");

          try {
            const successfulTrades = yield* tradingOrchestrator.processNewListings();

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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Manual listing processing failed", error as Error);

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
      );
    }),

  // Get trading statistics
  getTradingStats: protectedProcedure
    .query(async () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching trading statistics");

          try {
            const stats = yield* tradingOrchestrator.getTradingStatistics();

            yield* TradingLogger.logInfo("Trading statistics fetched successfully", stats);

            return {
              ...stats,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Failed to fetch trading statistics", error as Error);

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
      );
    }),

  // Get detector statistics
  getDetectorStats: protectedProcedure
    .query(async () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching detector statistics");

          try {
            const stats = yield* listingDetector.getStatistics();

            yield* TradingLogger.logInfo("Detector statistics fetched successfully", stats);

            return {
              ...stats,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            yield* TradingLogger.logError("Failed to fetch detector statistics", error as Error);

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
      );
    }),
});
