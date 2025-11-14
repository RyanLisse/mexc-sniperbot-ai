import { db, tradeAttempt } from "@mexc-sniperbot-ai/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError, TradingLogger } from "../lib/effect";
import { accountService } from "./account-service";

export type PortfolioPerformancePoint = {
  timestamp: Date;
  value: number; // USD value
};

export type PortfolioMetrics = {
  portfolioValue: number;
  activeTrades: number;
  winRate: number;
  averageProfitPerTrade: number;
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
};

export type PortfolioPerformanceData = {
  window: "1D" | "1W" | "1M" | "3M";
  data: PortfolioPerformancePoint[];
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
};

export const portfolioService = {
  getPortfolioValue(): Effect.Effect<number, DatabaseError> {
    return accountService.getTotalUsdValue().pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseError({
            message: `Failed to get portfolio value: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "PORTFOLIO_VALUE_ERROR",
            timestamp: new Date(),
          })
        )
      )
    );
  },

  getActiveTrades(): Effect.Effect<number, DatabaseError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Fetching active trades count");

      const activeTrades = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select()
            .from(tradeAttempt)
            .where(eq(tradeAttempt.status, "PENDING"));

          return result.length;
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch active trades: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "ACTIVE_TRADES_FETCH_ERROR",
            timestamp: new Date(),
          }),
      });

      return activeTrades;
    });
  },

  getWinRate(): Effect.Effect<number, DatabaseError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Calculating win rate");

      const trades = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select()
            .from(tradeAttempt)
            .orderBy(desc(tradeAttempt.createdAt))
            .limit(100); // Last 100 trades

          return result;
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch trades for win rate: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "WIN_RATE_CALCULATION_ERROR",
            timestamp: new Date(),
          }),
      });

      if (trades.length === 0) {
        return 0;
      }

      const successfulTrades = trades.filter(
        (trade) => trade.status === "SUCCESS"
      ).length;

      const winRate = (successfulTrades / trades.length) * 100;

      return Math.round(winRate * 100) / 100; // Round to 2 decimal places
    });
  },

  getAverageProfitPerTrade(): Effect.Effect<number, DatabaseError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Calculating average profit per trade");

      const trades = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select()
            .from(tradeAttempt)
            .where(eq(tradeAttempt.status, "SUCCESS"))
            .orderBy(desc(tradeAttempt.createdAt))
            .limit(100);

          return result;
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch trades for profit calculation: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "AVG_PROFIT_CALCULATION_ERROR",
            timestamp: new Date(),
          }),
      });

      if (trades.length === 0) {
        return 0;
      }

      // Calculate profit from executed price and quantity
      // This is simplified - in production, you'd calculate actual profit/loss
      const totalProfit = trades.reduce((sum, trade) => {
        const executedPrice = Number.parseFloat(trade.executedPrice ?? "0");
        const executedQuantity = Number.parseFloat(
          trade.executedQuantity ?? "0"
        );
        return sum + executedPrice * executedQuantity;
      }, 0);

      const averageProfit = totalProfit / trades.length;

      return Math.round(averageProfit * 100) / 100; // Round to 2 decimal places
    });
  },

  getPortfolioMetrics(): Effect.Effect<PortfolioMetrics, DatabaseError> {
    return Effect.gen(function* () {
      const [portfolioValue, activeTrades, winRate, avgProfit, totalTrades] =
        yield* Effect.all([
          this.getPortfolioValue(),
          this.getActiveTrades(),
          this.getWinRate(),
          this.getAverageProfitPerTrade(),
          this.getTotalTrades(),
        ]);

      const successfulTrades = Math.round((totalTrades * winRate) / 100);
      const totalProfit = avgProfit * successfulTrades;

      return {
        portfolioValue,
        activeTrades,
        winRate,
        averageProfitPerTrade: avgProfit,
        totalTrades,
        successfulTrades,
        totalProfit,
      };
    }).bind(undefined, this);
  },

  getTotalTrades(): Effect.Effect<number, DatabaseError> {
    return Effect.gen(function* () {
      const trades = yield* Effect.tryPromise({
        try: async () => {
          const result = await db.select().from(tradeAttempt);
          return result.length;
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch total trades: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "TOTAL_TRADES_FETCH_ERROR",
            timestamp: new Date(),
          }),
      });

      return trades;
    });
  },

  getPortfolioPerformance(
    window: "1D" | "1W" | "1M" | "3M"
  ): Effect.Effect<PortfolioPerformanceData, DatabaseError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug(
        `Fetching portfolio performance for ${window}`
      );

      // Calculate time range
      const now = new Date();
      const startDate = new Date();
      switch (window) {
        case "1D":
          startDate.setHours(now.getHours() - 24);
          break;
        case "1W":
          startDate.setDate(now.getDate() - 7);
          break;
        case "1M":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "3M":
          startDate.setMonth(now.getMonth() - 3);
          break;
      }

      // Fetch trades in the time range
      const _trades = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select()
            .from(tradeAttempt)
            .where(
              and(
                gte(tradeAttempt.createdAt, startDate),
                eq(tradeAttempt.status, "SUCCESS")
              )
            )
            .orderBy(desc(tradeAttempt.createdAt));

          return result;
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch portfolio performance: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "PORTFOLIO_PERFORMANCE_FETCH_ERROR",
            timestamp: new Date(),
          }),
      });

      // Get current portfolio value
      const currentValue = yield* this.getPortfolioValue();

      // Generate time series data points
      // For simplicity, we'll create hourly points
      const dataPoints: PortfolioPerformancePoint[] = [];
      const hoursDiff = Math.ceil(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60)
      );

      // Start with initial value (simplified - in production, use actual historical data)
      const initialValue = currentValue * 0.95; // Mock starting value

      for (let i = 0; i <= hoursDiff; i++) {
        const timestamp = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        // Simulate value growth (in production, use actual historical data)
        const value =
          initialValue +
          ((currentValue - initialValue) / hoursDiff) * i +
          Math.random() * (currentValue * 0.02); // Add some variance

        dataPoints.push({
          timestamp,
          value: Math.round(value * 100) / 100,
        });
      }

      const change = currentValue - initialValue;
      const changePercent = (change / initialValue) * 100;

      return {
        window,
        data: dataPoints,
        startValue: initialValue,
        endValue: currentValue,
        change,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    }).bind(undefined, this);
  },
};
