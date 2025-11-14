import { db, tradeAttempt } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { MEXCApiError, TradingLogger } from "../lib/effect";
import { accountService } from "./account-service";
import { mexcClient } from "./mexc-client";

/**
 * Position data structure
 */
export type Position = {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  buyOrderId: string;
  tradeAttemptId: string;
};

/**
 * Position tracker service
 * Tracks open positions from successful buy orders
 */
export class PositionTracker {
  private readonly positionsCache = new Map<string, Position>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds

  /**
   * Get all open positions
   * Queries database for successful BUY orders that haven't been sold
   */
  getOpenPositions = (): Effect.Effect<Position[], MEXCApiError> => {
    return Effect.gen(function* () {
      const now = Date.now();

      // Return cached positions if still valid
      if (
        this.positionsCache.size > 0 &&
        now - this.lastCacheUpdate < this.CACHE_TTL
      ) {
        yield* TradingLogger.logDebug(
          `Returning ${this.positionsCache.size} cached positions`
        );
        return Array.from(this.positionsCache.values());
      }

      yield* TradingLogger.logDebug("Fetching open positions from database");

      // Query successful BUY orders from database
      const buyOrders = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradeAttempt)
            .where(
              and(
                eq(tradeAttempt.side, "BUY"),
                eq(tradeAttempt.status, "SUCCESS")
              )
            )
            .orderBy(desc(tradeAttempt.createdAt)),
        catch: (error) => {
          throw new MEXCApiError({
            message: `Failed to fetch buy orders: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "DATABASE_ERROR",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });

      // Get account balances to verify holdings
      const accountBalances = yield* accountService.getAccountBalance();

      // Build positions map
      const positionsMap = new Map<string, Position>();

      for (const buyOrder of buyOrders) {
        // Extract base asset from symbol (e.g., "BTCUSDT" -> "BTC")
        const baseAsset = this.extractBaseAsset(buyOrder.symbol);

        // Find balance for this asset
        const balance = accountBalances.find((b) => b.asset === baseAsset);

        // Only include positions where we still have balance
        if (balance && Number.parseFloat(balance.free) > 0) {
          const entryPrice = buyOrder.executedPrice
            ? Number.parseFloat(buyOrder.executedPrice)
            : buyOrder.price
              ? Number.parseFloat(buyOrder.price)
              : 0;

          const quantity = buyOrder.executedQuantity
            ? Number.parseFloat(buyOrder.executedQuantity)
            : Number.parseFloat(buyOrder.quantity);

          // Get current price
          let currentPrice = entryPrice;
          try {
            const ticker = yield* mexcClient.getTicker(buyOrder.symbol);
            currentPrice = Number.parseFloat(ticker.price);
          } catch {
            // If ticker fetch fails, use entry price
            yield* TradingLogger.logDebug(
              `Failed to get current price for ${buyOrder.symbol}, using entry price`
            );
          }

          // Calculate unrealized PnL
          const unrealizedPnL = (currentPrice - entryPrice) * quantity;
          const unrealizedPnLPercent =
            entryPrice > 0
              ? ((currentPrice - entryPrice) / entryPrice) * 100
              : 0;

          const position: Position = {
            symbol: buyOrder.symbol,
            quantity,
            entryPrice,
            entryTime: buyOrder.createdAt,
            currentPrice,
            unrealizedPnL,
            unrealizedPnLPercent,
            buyOrderId: buyOrder.orderId || "",
            tradeAttemptId: buyOrder.id,
          };

          // Use symbol as key, but prefer the most recent buy order if multiple exist
          const existingPosition = positionsMap.get(buyOrder.symbol);
          if (
            !existingPosition ||
            position.entryTime > existingPosition.entryTime
          ) {
            positionsMap.set(buyOrder.symbol, position);
          }
        }
      }

      // Update cache
      this.positionsCache.clear();
      for (const [symbol, position] of positionsMap) {
        this.positionsCache.set(symbol, position);
      }
      this.lastCacheUpdate = now;

      yield* TradingLogger.logInfo(
        `Found ${positionsMap.size} open positions`,
        {
          symbols: Array.from(positionsMap.keys()),
        }
      );

      return Array.from(positionsMap.values());
    });
  };

  /**
   * Get position for a specific symbol
   */
  getPosition = (
    symbol: string
  ): Effect.Effect<Position | null, MEXCApiError> =>
    Effect.gen(function* () {
      const positions = yield* this.getOpenPositions();
      return positions.find((p) => p.symbol === symbol) ?? null;
    });

  /**
   * Add position when buy order succeeds
   */
  addPosition = (buyOrder: {
    symbol: string;
    orderId: string;
    executedPrice: string;
    executedQuantity: string;
    tradeAttemptId: string;
    createdAt: Date;
  }): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      const entryPrice = Number.parseFloat(buyOrder.executedPrice);
      const quantity = Number.parseFloat(buyOrder.executedQuantity);

      // Get current price
      let currentPrice = entryPrice;
      try {
        const ticker = yield* mexcClient.getTicker(buyOrder.symbol);
        currentPrice = Number.parseFloat(ticker.price);
      } catch {
        // If ticker fetch fails, use entry price
        yield* TradingLogger.logDebug(
          `Failed to get current price for ${buyOrder.symbol}, using entry price`
        );
      }

      const unrealizedPnL = (currentPrice - entryPrice) * quantity;
      const unrealizedPnLPercent =
        entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

      const position: Position = {
        symbol: buyOrder.symbol,
        quantity,
        entryPrice,
        entryTime: buyOrder.createdAt,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent,
        buyOrderId: buyOrder.orderId,
        tradeAttemptId: buyOrder.tradeAttemptId,
      };

      this.positionsCache.set(buyOrder.symbol, position);
      this.lastCacheUpdate = Date.now();

      yield* TradingLogger.logInfo(`Added position for ${buyOrder.symbol}`, {
        entryPrice,
        quantity,
        currentPrice,
      });
    });
  };

  /**
   * Remove position when sell order succeeds
   */
  removePosition = (symbol: string): Effect.Effect<void, MEXCApiError> =>
    Effect.gen(function* () {
      if (this.positionsCache.has(symbol)) {
        this.positionsCache.delete(symbol);
        this.lastCacheUpdate = Date.now();
        yield* TradingLogger.logInfo(`Removed position for ${symbol}`);
      }
    });

  /**
   * Update position data (e.g., current price, PnL, quantity)
   */
  updatePosition = (
    symbol: string,
    data: Partial<
      Pick<
        Position,
        "currentPrice" | "unrealizedPnL" | "unrealizedPnLPercent" | "quantity"
      >
    >
  ): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      const position = this.positionsCache.get(symbol);
      if (position) {
        const updatedPosition: Position = {
          ...position,
          ...data,
        };

        // Update quantity if provided
        if (data.quantity !== undefined) {
          updatedPosition.quantity = data.quantity;
        }

        // Recalculate PnL if currentPrice changed
        if (data.currentPrice !== undefined) {
          const quantity = data.quantity ?? updatedPosition.quantity;
          updatedPosition.unrealizedPnL =
            (data.currentPrice - position.entryPrice) * quantity;
          updatedPosition.unrealizedPnLPercent =
            position.entryPrice > 0
              ? ((data.currentPrice - position.entryPrice) /
                  position.entryPrice) *
                100
              : 0;
        } else if (data.quantity !== undefined) {
          // Recalculate PnL with new quantity if only quantity changed
          updatedPosition.unrealizedPnL =
            (updatedPosition.currentPrice - position.entryPrice) *
            data.quantity;
          updatedPosition.unrealizedPnLPercent =
            position.entryPrice > 0
              ? ((updatedPosition.currentPrice - position.entryPrice) /
                  position.entryPrice) *
                100
              : 0;
        }

        this.positionsCache.set(symbol, updatedPosition);
        this.lastCacheUpdate = Date.now();
      }
    });
  };

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.positionsCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Extract base asset from symbol (e.g., "BTCUSDT" -> "BTC")
   */
  private extractBaseAsset(symbol: string): string {
    const quoteAssets = ["USDT", "USDC", "BTC", "ETH", "BNB"];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        return symbol.slice(0, -quote.length);
      }
    }
    // If no quote asset found, return symbol as-is
    return symbol;
  }
}

// Export singleton instance
export const positionTracker = new PositionTracker();
