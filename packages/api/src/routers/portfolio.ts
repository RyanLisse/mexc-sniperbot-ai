import { Effect } from "effect";
import { z } from "zod";
import { credentialValidatedProcedure, publicProcedure, router } from "../index";
import { DatabaseError } from "../lib/effect";
import { accountService } from "../services/account-service";
import { portfolioService } from "../services/portfolio-service";

const performanceWindowSchema = z.enum(["1D", "1W", "1M", "3M"]);

export const portfolioRouter = router({
  getBalance: publicProcedure.query(async () => {
    try {
      return await Effect.runPromise(
        accountService.getAccountBalance().pipe(
          Effect.catchAll((error) => {
            // Return empty array instead of throwing to prevent frontend crashes
            console.error("Failed to fetch account balance:", error);
            return Effect.succeed([]);
          })
        )
      );
    } catch (error) {
      console.error("Account balance fetch error:", error);
      return [];
    }
  }),

  getAccountInfo: credentialValidatedProcedure.query(async () => {
    try {
      return await Effect.runPromise(
        accountService.getAccountInfo().pipe(
          Effect.catchAll((error) => {
            // Return null instead of throwing to prevent frontend crashes
            console.error("Failed to fetch account info:", error);
            return Effect.succeed(null);
          })
        )
      );
    } catch (error) {
      console.error("Account info fetch error:", error);
      return null;
    }
  }),

  getPortfolioValue: credentialValidatedProcedure.query(async () =>
    Effect.runPromise(
      portfolioService.getPortfolioValue().pipe(
        Effect.catchAll((error) => {
          throw new DatabaseError({
            message: `Failed to fetch portfolio value: ${error.message}`,
            code: "PORTFOLIO_VALUE_FETCH_ERROR",
            timestamp: new Date(),
          });
        })
      )
    )
  ),

  getPortfolioPerformance: credentialValidatedProcedure
    .input(
      z.object({
        window: performanceWindowSchema.default("1D"),
      })
    )
    .query(async ({ input }) =>
      Effect.runPromise(
        portfolioService.getPortfolioPerformance(input.window).pipe(
          Effect.catchAll((error) => {
            throw new DatabaseError({
              message: `Failed to fetch portfolio performance: ${error.message}`,
              code: "PORTFOLIO_PERFORMANCE_FETCH_ERROR",
              timestamp: new Date(),
            });
          })
        )
      )
    ),

  getPortfolioMetrics: credentialValidatedProcedure.query(async () =>
    Effect.runPromise(
      portfolioService.getPortfolioMetrics().pipe(
        Effect.catchAll((error) => {
          throw new DatabaseError({
            message: `Failed to fetch portfolio metrics: ${error.message}`,
            code: "PORTFOLIO_METRICS_FETCH_ERROR",
            timestamp: new Date(),
          });
        })
      )
    )
  ),
});
