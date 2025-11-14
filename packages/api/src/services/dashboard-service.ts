import {
  botStatus,
  db,
  listingEvent,
  tradeAttempt,
} from "@mexc-sniperbot-ai/db";
import { desc, gt } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError, TradingLogger } from "../lib/effect";
import { websocketService } from "./websocket-service";

const DEFAULT_LISTING_LOOKBACK_HOURS = 24;
const DEFAULT_TRADE_HISTORY_LIMIT = 25;

const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getExecutionTimeMs = (trade: typeof tradeAttempt.$inferSelect) => {
  const submitted = trade.submittedAt ?? trade.detectedAt;
  const completed = trade.completedAt ?? trade.submittedAt ?? trade.detectedAt;
  if (!(submitted && completed)) {
    return 0;
  }

  return completed.getTime() - submitted.getTime();
};

const normalizeTrade = (trade: typeof tradeAttempt.$inferSelect) => {
  const executedQuantity = toNumber(trade.executedQuantity);
  const executedPrice = toNumber(trade.executedPrice);

  return {
    id: trade.id,
    symbol: trade.symbol,
    status: trade.status,
    strategy: trade.type,
    quantity: toNumber(trade.quantity),
    price: toNumber(trade.price),
    executedPrice,
    executedQuantity,
    createdAt: trade.createdAt?.toISOString() ?? new Date().toISOString(),
    completedAt: trade.completedAt?.toISOString(),
    executionTimeMs: getExecutionTimeMs(trade),
    value: Number((executedQuantity * executedPrice).toFixed(6)),
    errorCode: trade.errorCode ?? undefined,
    errorMessage: trade.errorMessage ?? undefined,
  };
};

const normalizeListing = (listing: typeof listingEvent.$inferSelect) => ({
  id: listing.id,
  symbol: listing.symbol,
  price: toNumber(listing.currentPrice ?? listing.initialPrice),
  detectedAt: listing.detectedAt?.toISOString() ?? new Date().toISOString(),
  status: listing.status,
  processed: listing.processed,
  baseAsset: listing.baseAsset,
  quoteAsset: listing.quoteAsset,
});

export type DashboardSnapshot = {
  totals: {
    trades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
  };
  performance: {
    averageExecutionTimeMs: number;
    averageTradeValue: number;
    volume: number;
  };
  botStatus: {
    isRunning: boolean;
    mexcApiStatus: string;
    apiResponseTime: number;
    lastHeartbeat: string;
  } | null;
  listings: ReturnType<typeof normalizeListing>[];
  trades: ReturnType<typeof normalizeTrade>[];
  generatedAt: string;
};

export type DashboardPerformanceWindow = "1h" | "6h" | "24h" | "7d";

export type DashboardAlert = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  occurredAt: string;
};

const withDatabaseError = (message: string) => (error: unknown) =>
  new DatabaseError({
    message: `${message}: ${error instanceof Error ? error.message : "Unknown error"}`,
    code: "DATABASE_ERROR",
    timestamp: new Date(),
  });

const fetchRecentTrades = (limit: number) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(tradeAttempt)
        .orderBy(desc(tradeAttempt.createdAt))
        .limit(limit),
    catch: withDatabaseError("Failed to fetch trade attempts"),
  });

const fetchRecentListings = (hours: number, limit: number) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(listingEvent)
        .where(gt(listingEvent.detectedAt, since))
        .orderBy(desc(listingEvent.detectedAt))
        .limit(limit),
    catch: withDatabaseError("Failed to fetch listing events"),
  });
};

const fetchBotStatus = () =>
  Effect.tryPromise({
    try: () =>
      db.select().from(botStatus).orderBy(desc(botStatus.updatedAt)).limit(1),
    catch: withDatabaseError("Failed to fetch bot status"),
  });

const summarizeTrades = (trades: ReturnType<typeof normalizeTrade>[]) => {
  if (trades.length === 0) {
    return {
      totals: {
        trades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
      },
      performance: {
        averageExecutionTimeMs: 0,
        averageTradeValue: 0,
        volume: 0,
      },
    };
  }

  const successfulTrades = trades.filter((trade) => trade.status === "SUCCESS");
  const failedTrades = trades.filter((trade) => trade.status === "FAILED");
  const successRate =
    trades.length === 0 ? 0 : (successfulTrades.length / trades.length) * 100;

  const avgExecution =
    trades.reduce((acc, trade) => acc + trade.executionTimeMs, 0) /
    trades.length;

  const totalValue = successfulTrades.reduce(
    (acc, trade) => acc + trade.value,
    0
  );
  const averageTradeValue =
    successfulTrades.length === 0 ? 0 : totalValue / successfulTrades.length;

  return {
    totals: {
      trades: trades.length,
      successfulTrades: successfulTrades.length,
      failedTrades: failedTrades.length,
      successRate: Number(successRate.toFixed(2)),
    },
    performance: {
      averageExecutionTimeMs: Math.round(avgExecution),
      averageTradeValue: Number(averageTradeValue.toFixed(4)),
      volume: Number(totalValue.toFixed(4)),
    },
  };
};

const buildAlerts = (
  trades: ReturnType<typeof normalizeTrade>[]
): DashboardAlert[] =>
  trades
    .filter((trade) => trade.status === "FAILED" || trade.errorCode)
    .slice(0, 5)
    .map((trade) => ({
      id: `alert_${trade.id}`,
      severity: trade.status === "FAILED" ? "high" : "medium",
      title: `Trade issue for ${trade.symbol}`,
      description: trade.errorMessage ?? "Trade failed without error details",
      occurredAt: trade.completedAt ?? trade.createdAt,
    }));

export const dashboardService = {
  getSnapshot(limit = DEFAULT_TRADE_HISTORY_LIMIT) {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Generating dashboard snapshot", { limit });

      const [tradesRaw, listingsRaw, botStatuses] = yield* Effect.all([
        fetchRecentTrades(limit),
        fetchRecentListings(DEFAULT_LISTING_LOOKBACK_HOURS, limit),
        fetchBotStatus(),
      ]);

      const trades = tradesRaw.map(normalizeTrade);
      const listings = listingsRaw.map(normalizeListing);
      const summary = summarizeTrades(trades);

      const bot = botStatuses.at(0)
        ? {
            isRunning: botStatuses[0].isRunning,
            mexcApiStatus: botStatuses[0].mexcApiStatus,
            apiResponseTime: botStatuses[0].apiResponseTime,
            lastHeartbeat:
              botStatuses[0].lastHeartbeat?.toISOString() ??
              new Date().toISOString(),
          }
        : null;

      const snapshot: DashboardSnapshot = {
        totals: summary.totals,
        performance: summary.performance,
        botStatus: bot,
        listings,
        trades,
        generatedAt: new Date().toISOString(),
      };

      websocketService.broadcast({ type: "snapshot", payload: snapshot });

      return snapshot;
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new DatabaseError({
            message:
              error instanceof Error
                ? error.message
                : "Failed to build dashboard snapshot",
            code: "DASHBOARD_SNAPSHOT_FAILED",
            timestamp: new Date(),
          })
        )
      )
    );
  },

  getTradeHistory(limit = DEFAULT_TRADE_HISTORY_LIMIT) {
    return Effect.map(fetchRecentTrades(Math.min(limit, 100)), (rows) =>
      rows.map(normalizeTrade)
    );
  },

  getPerformanceMetrics(window: DashboardPerformanceWindow) {
    const hoursLookup: Record<DashboardPerformanceWindow, number> = {
      "1h": 1,
      "6h": 6,
      "24h": 24,
      "7d": 24 * 7,
    };

    const hours = hoursLookup[window];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return Effect.map(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradeAttempt)
            .where(gt(tradeAttempt.createdAt, since)),
        catch: withDatabaseError("Failed to compute performance metrics"),
      }),
      (rows) => {
        const trades = rows.map(normalizeTrade);
        const summary = summarizeTrades(trades);

        return {
          window,
          trades: summary.totals.trades,
          successRate: summary.totals.successRate,
          averageExecutionTimeMs: summary.performance.averageExecutionTimeMs,
          volume: summary.performance.volume,
        };
      }
    );
  },

  getAlerts(limit = 5) {
    return Effect.map(fetchRecentTrades(50), (rows) =>
      buildAlerts(rows.map(normalizeTrade)).slice(0, limit)
    );
  },

  getListings(limit = 10) {
    return Effect.map(
      fetchRecentListings(DEFAULT_LISTING_LOOKBACK_HOURS, limit),
      (rows) => rows.map(normalizeListing)
    );
  },
};
