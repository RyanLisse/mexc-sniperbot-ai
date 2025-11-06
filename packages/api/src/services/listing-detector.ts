import { Effect, Layer, Context } from "effect";
import { mexcClient } from "./mexc-client";
import { MEXCApiError, TradingLogger } from "../lib/effect";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { listingEvent, tradingConfiguration } from "@mexc-sniperbot-ai/db";

// Service interface for dependency injection
export interface ListingDetectorService {
  detectNewListings: Effect.Effect<string[], MEXCApiError>;
  checkSymbolActivity: (symbol: string) => Effect.Effect<boolean, MEXCApiError>;
  getRecentListings: (hours: number) => Effect.Effect<Array<{
    symbol: string;
    detectedAt: Date;
    price: string;
  }>, MEXCApiError>;
}

// Service tag
export const ListingDetectorService = Context.Tag<ListingDetectorService>("ListingDetectorService");

// Implementation class
export class ListingDetector implements ListingDetectorService {
  private readonly knownSymbols = new Set<string>();
  private lastCheckTime = 0;

  // Initialize with existing symbols from MEXC
  initialize = (): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Initializing listing detector with existing symbols");
      
      const symbols = yield* mexcClient.getSymbols();
      symbols.forEach(symbol => {
        this.knownSymbols.add(symbol.symbol);
      });

      this.lastCheckTime = Date.now();
      
      yield* TradingLogger.logInfo(`Initialized with ${symbols.length} known symbols`);
    });
  };

  // Detect new listings by comparing current symbols with known ones
  detectNewListings = (): Effect.Effect<string[], MEXCApiError> => {
    return Effect.gen(function* () {
      const currentTime = Date.now();
      
      // Rate limiting: don't check more frequently than every 30 seconds
      if (currentTime - this.lastCheckTime < 30_000) {
        yield* TradingLogger.logDebug("Skipping listing detection - rate limited");
        return [];
      }

      yield* TradingLogger.logInfo("Starting new listing detection");
      
      const currentSymbols = yield* mexcClient.getSymbols();
      const newListings: string[] = [];

      for (const symbol of currentSymbols) {
        if (!this.knownSymbols.has(symbol.symbol)) {
          // Check if it's a truly new listing (recent activity)
          const isRecentlyActive = yield* this.checkSymbolActivity(symbol.symbol);
          
          if (isRecentlyActive) {
            newListings.push(symbol.symbol);
            this.knownSymbols.add(symbol.symbol);
            
            yield* TradingLogger.logListingDetected(symbol.symbol, "NEW_LISTING");
            
            // Save to database
            yield* this.saveListingEvent(symbol.symbol, "NEW_LISTING_DETECTED");
          }
        }
      }

      this.lastCheckTime = currentTime;
      
      if (newListings.length > 0) {
        yield* TradingLogger.logInfo(`Detected ${newListings.length} new listings: ${newListings.join(", ")}`);
      } else {
        yield* TradingLogger.logDebug("No new listings detected");
      }

      return newListings;
    });
  };

  // Check if a symbol has recent activity (indicating it's not just a delisted/relisted symbol)
  checkSymbolActivity = (symbol: string): Effect.Effect<boolean, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        // Try to get ticker information
        const ticker = yield* mexcClient.getTicker(symbol);
        
        // Check if there's recent price data and volume
        const hasRecentActivity = 
          ticker.price !== "0.00000000" && 
          parseFloat(ticker.volume) > 0 &&
          (Date.now() - ticker.timestamp) < 300_000; // Activity within last 5 minutes

        if (hasRecentActivity) {
          yield* TradingLogger.logDebug(`Symbol ${symbol} shows recent activity`, {
            price: ticker.price,
            volume: ticker.volume,
            timestamp: ticker.timestamp,
          });
        }

        return hasRecentActivity;
      } catch (_error) {
        // If we can't get ticker data, it's likely not an active symbol
        yield* TradingLogger.logDebug(`Symbol ${symbol} has no recent activity (ticker fetch failed)`);
        return false;
      }
    });
  };

  // Get recent listings from database
  getRecentListings = (hours: number = 24): Effect.Effect<Array<{
    symbol: string;
    detectedAt: Date;
    price: string;
  }>, MEXCApiError> => {
    return Effect.gen(function* () {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const recentListings = yield* Effect.tryPromise({
        try: () => db.select()
          .from(listingEvent)
          .where(
            and(
              eq(listingEvent.eventType, "NEW_LISTING_DETECTED"),
              gt(listingEvent.detectedAt, since)
            )
          )
          .orderBy(desc(listingEvent.detectedAt))
          .limit(100),
        catch: (error) => {
          throw new MEXCApiError({
            message: `Failed to fetch recent listings: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "DATABASE_ERROR",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });

      return recentListings.map(listing => ({
        symbol: listing.symbol,
        detectedAt: listing.detectedAt,
        price: listing.price || "0.00000000",
      }));
    });
  };

  // Save listing event to database
  private saveListingEvent = (
    symbol: string,
    eventType: string
  ): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        // Get current price for the symbol
        let currentPrice = "0.00000000";
        try {
          const ticker = yield* mexcClient.getTicker(symbol);
          currentPrice = ticker.price;
        } catch {
          // Price fetch failed, use default
          currentPrice = "0.00000000";
        }

        // Insert listing event
        yield* Effect.tryPromise({
          try: () => db.insert(listingEvent).values({
            id: `listing_${symbol}_${Date.now()}`,
            symbol,
            eventType,
            price: currentPrice,
            detectedAt: new Date(),
            metadata: {
              detectionMethod: "API_POLLING",
              detectorVersion: "1.0.0",
            },
          }),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to save listing event: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "DATABASE_ERROR",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logInfo(`Saved listing event for ${symbol}`, {
          eventType,
          price: currentPrice,
        });
      } catch (error) {
        // Log error but don't fail the detection process
        yield* TradingLogger.logError(`Failed to save listing event for ${symbol}`, error as Error);
      }
    });
  };

  // Check if symbol is enabled for trading
  isSymbolEnabled = (symbol: string): Effect.Effect<boolean, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        const configs = yield* Effect.tryPromise({
          try: () => db.select()
            .from(tradingConfiguration)
            .where(eq(tradingConfiguration.isActive, true)),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to fetch trading configurations: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "DATABASE_ERROR",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        if (configs.length === 0) {
          return false; // No active configurations
        }

        // Check if symbol is in any enabled configuration's enabledPairs
        return configs.some(config => 
          config.enabledPairs && 
          Array.isArray(config.enabledPairs) && 
          config.enabledPairs.includes(symbol)
        );
      } catch (error) {
        yield* TradingLogger.logError(`Failed to check if symbol ${symbol} is enabled`, error as Error);
        return false; // Default to not enabled on error
      }
    });
  };

  // Get detector statistics
  getStatistics = (): Effect.Effect<{
    knownSymbolsCount: number;
    lastCheckTime: Date;
    uptime: number;
  }, MEXCApiError> => {
    return Effect.sync(() => ({
      knownSymbolsCount: this.knownSymbols.size,
      lastCheckTime: new Date(this.lastCheckTime),
      uptime: Date.now() - (this.lastCheckTime > 0 ? this.lastCheckTime : Date.now()),
    }));
  };
}

// Create layer for dependency injection
export const ListingDetectorLive = Layer.succeed(
  ListingDetectorService,
  new ListingDetector()
);

// Export singleton instance
export const listingDetector = new ListingDetector();
