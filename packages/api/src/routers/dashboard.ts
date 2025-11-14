import { Effect } from "effect";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { TradingLogger } from "../lib/effect";
import { dashboardService } from "../services/dashboard-service";

const snapshotInputSchema = z.object({
  limit: z.number().positive().max(100).default(25),
});

const performanceWindowSchema = z.enum(["1h", "6h", "24h", "7d"]);

const alertsInputSchema = z.object({
  limit: z.number().positive().max(20).default(5),
});

export const dashboardRouter = router({
  getSnapshot: publicProcedure
    .input(snapshotInputSchema)
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logDebug("Fetching dashboard snapshot", {
            limit: input.limit,
          });

          const snapshot = yield* dashboardService.getSnapshot(input.limit);

          return {
            success: true,
            data: snapshot,
          };
        })
      )
    ),

  getTradeHistory: publicProcedure
    .input(z.object({ limit: z.number().positive().max(100).default(25) }))
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logDebug("Fetching trade history", {
            limit: input.limit,
          });

          const trades = yield* dashboardService.getTradeHistory(input.limit);

          return {
            success: true,
            data: trades,
          };
        })
      )
    ),

  getPerformanceMetrics: publicProcedure
    .input(z.object({ window: performanceWindowSchema.default("24h") }))
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logDebug("Fetching performance metrics", {
            window: input.window,
          });

          const metrics = yield* dashboardService.getPerformanceMetrics(
            input.window
          );

          return {
            success: true,
            data: metrics,
          };
        })
      )
    ),

  getAlerts: publicProcedure
    .input(alertsInputSchema)
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logDebug("Fetching alerts", {
            limit: input.limit,
          });

          const alerts = yield* dashboardService.getAlerts(input.limit);

          return {
            success: true,
            data: alerts,
          };
        })
      )
    ),

  getListings: publicProcedure
    .input(z.object({ limit: z.number().positive().max(50).default(10) }))
    .query(async ({ input }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logDebug("Fetching listings", {
            limit: input.limit,
          });

          const listings = yield* dashboardService.getListings(input.limit);

          return {
            success: true,
            data: listings,
          };
        })
      )
    ),
});
