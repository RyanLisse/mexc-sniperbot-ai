import { db, listingEvent, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { desc, eq, gt } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { MEXCApiError, TradingLogger } from "../lib/effect";
import {
  filterListingsByTimeWindow,
  filterTodaysListings,
  filterTomorrowsListings,
  isUpcomingListing,
} from "./calendar-utils";
import { type CalendarEntry, mexcClient } from "./mexc-client";
import { multiLayerDetector } from "./multi-layer-detector";

// Service interface for dependency injection
export type ListingDetectorService = {
  detectNewListings: Effect.Effect<string[], MEXCApiError>;
  checkSymbolActivity: (symbol: string) => Effect.Effect<boolean, MEXCApiError>;
  getRecentListings: (hours: number) => Effect.Effect<
    Array<{
      symbol: string;
      detectedAt: Date;
      price: string;
    }>,
    MEXCApiError
  >;
};

// Service tag
export const ListingDetectorService = Context.Tag<ListingDetectorService>(
  "ListingDetectorService"
);

// Implementation class
export class ListingDetector implements ListingDetectorService {
  private readonly knownSymbols = new Set<string>();
  private readonly knownVcoinIds = new Set<string>(); // Track calendar vcoinIds
  private lastCheckTime = 0;
  private lastCalendarCheckTime = 0;

  // Initialize with existing symbols from MEXC and calendar listings
  initialize = (): Effect.Effect<void, MEXCApiError> =>
    Effect.gen(function* () {
      yield* TradingLogger.logInfo(
        "Initializing listing detector with multi-layer detection"
      );

      // Initialize multi-layer detector first
      yield* multiLayerDetector.initialize();

      // Sync known symbols from multi-layer detector
      // (Note: multiLayerDetector maintains its own state, but we sync for compatibility)
      const symbols = yield* mexcClient.getSymbols();
      symbols.forEach((symbol) => {
        this.knownSymbols.add(symbol.symbol);
      });

      // Initialize with existing calendar listings
      try {
        const calendarEntries = yield* mexcClient.getCalendarListings();
        calendarEntries.forEach((entry) => {
          if (entry.vcoinId) {
            this.knownVcoinIds.add(entry.vcoinId);
          }
          if (entry.symbol) {
            this.knownSymbols.add(entry.symbol);
          }
        });
        yield* TradingLogger.logInfo(
          `Initialized with ${calendarEntries.length} calendar entries`
        );
      } catch (error) {
        yield* TradingLogger.logDebug(
          "Failed to initialize calendar listings, continuing with symbols only"
        );
      }

      this.lastCheckTime = Date.now();
      this.lastCalendarCheckTime = Date.now();

      yield* TradingLogger.logInfo(
        `Initialized with ${this.knownSymbols.size} known symbols and ${this.knownVcoinIds.size} known vcoinIds`
      );
    });

  // Detect upcoming listings from calendar API (primary method)
  detectUpcomingListings = (
    hoursAhead = 48
  ): Effect.Effect<string[], MEXCApiError> => {
    return Effect.gen(function* () {
      const currentTime = Date.now();

      // Rate limiting: don't check more frequently than every 30 seconds
      if (currentTime - this.lastCalendarCheckTime < 30_000) {
        yield* TradingLogger.logDebug(
          "Skipping calendar listing detection - rate limited"
        );
        return [];
      }

      yield* TradingLogger.logInfo("Starting calendar-based listing detection");

      try {
        const calendarEntries = yield* mexcClient.getCalendarListings();
        const filteredEntries = filterListingsByTimeWindow(
          calendarEntries,
          hoursAhead
        );

        const newListings: string[] = [];

        for (const entry of filteredEntries) {
          // Check if this vcoinId is new (primary check)
          const isNewVcoinId =
            entry.vcoinId && !this.knownVcoinIds.has(entry.vcoinId);

          // Also check if symbol is new (secondary check)
          const isNewSymbol =
            entry.symbol && !this.knownSymbols.has(entry.symbol);

          if (isNewVcoinId || isNewSymbol) {
            // Add to known sets
            if (entry.vcoinId) {
              this.knownVcoinIds.add(entry.vcoinId);
            }
            if (entry.symbol) {
              this.knownSymbols.add(entry.symbol);
              newListings.push(entry.symbol);
            }

            yield* TradingLogger.logListingDetected(
              entry.symbol,
              "NEW_LISTING_CALENDAR"
            );

            // Save to database with calendar metadata
            yield* this.saveCalendarListingEvent(entry);
          }
        }

        this.lastCalendarCheckTime = currentTime;

        if (newListings.length > 0) {
          yield* TradingLogger.logInfo(
            `Detected ${newListings.length} new calendar listings: ${newListings.join(", ")}`
          );
        } else {
          yield* TradingLogger.logDebug("No new calendar listings detected");
        }

        return newListings;
      } catch (error) {
        yield* TradingLogger.logError(
          "Calendar listing detection failed, will fallback to symbol comparison",
          error as Error
        );
        return [];
      }
    });
  };

  // Detect new listings using multi-layer fallback strategy
  detectNewListings = (): Effect.Effect<string[], MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Starting multi-layer listing detection");

      // Use multi-layer detector (Layer 1: Calendar, Layer 2: SymbolsV2, Layer 3: ExchangeInfo)
      const detectedListings = yield* multiLayerDetector.detectAllLayers();

      if (detectedListings.length === 0) {
        yield* TradingLogger.logDebug(
          "No new listings detected via multi-layer detection"
        );
        return [];
      }

      // Extract symbols and save to database
      const newSymbols: string[] = [];
      for (const listing of detectedListings) {
        if (!this.knownSymbols.has(listing.symbol)) {
          this.knownSymbols.add(listing.symbol);
          newSymbols.push(listing.symbol);

          yield* TradingLogger.logListingDetected(
            listing.symbol,
            `NEW_LISTING_${listing.source.toUpperCase()}`
          );

          // Save to database with metadata
          yield* this.saveListingEvent(
            listing.symbol,
            `NEW_LISTING_DETECTED_${listing.source.toUpperCase()}`,
            listing.metadata
          );
        }
      }

      if (newSymbols.length > 0) {
        yield* TradingLogger.logInfo(
          `Multi-layer detection found ${newSymbols.length} new listings: ${newSymbols.join(", ")}`
        );
      }

      return newSymbols;
    });
  };

  // Check if a symbol has recent activity (indicating it's not just a delisted/relisted symbol)
  checkSymbolActivity = (
    symbol: string
  ): Effect.Effect<boolean, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        // Try to get ticker information
        const ticker = yield* mexcClient.getTicker(symbol);

        // Check if there's recent price data and volume
        const hasRecentActivity =
          ticker.price !== "0.00000000" &&
          Number.parseFloat(ticker.volume) > 0 &&
          Date.now() - ticker.timestamp < 300_000; // Activity within last 5 minutes

        if (hasRecentActivity) {
          yield* TradingLogger.logDebug(
            `Symbol ${symbol} shows recent activity`,
            {
              price: ticker.price,
              volume: ticker.volume,
              timestamp: ticker.timestamp,
            }
          );
        }

        return hasRecentActivity;
      } catch (_error) {
        // If we can't get ticker data, it's likely not an active symbol
        yield* TradingLogger.logDebug(
          `Symbol ${symbol} has no recent activity (ticker fetch failed)`
        );
        return false;
      }
    });
  };

  // Get today's listings from calendar
  getTodaysListings = (): Effect.Effect<CalendarEntry[], MEXCApiError> =>
    Effect.gen(function* () {
      const calendarEntries = yield* mexcClient.getCalendarListings();
      return filterTodaysListings(calendarEntries);
    });

  // Get tomorrow's listings from calendar
  getTomorrowsListings = (): Effect.Effect<CalendarEntry[], MEXCApiError> =>
    Effect.gen(function* () {
      const calendarEntries = yield* mexcClient.getCalendarListings();
      return filterTomorrowsListings(calendarEntries);
    });

  // Get upcoming listings within specified hours
  getUpcomingListings = (
    hours = 48
  ): Effect.Effect<CalendarEntry[], MEXCApiError> =>
    Effect.gen(function* () {
      const calendarEntries = yield* mexcClient.getCalendarListings();
      return calendarEntries.filter((entry) => isUpcomingListing(entry, hours));
    });

  // Get recent listings from database
  getRecentListings = (
    hours = 24
  ): Effect.Effect<
    Array<{
      symbol: string;
      detectedAt: Date;
      price: string;
    }>,
    MEXCApiError
  > =>
    Effect.gen(function* () {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const recentListings = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(listingEvent)
            .where(gt(listingEvent.detectedAt, since))
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

      return recentListings.map((listing) => ({
        symbol: listing.symbol,
        detectedAt: listing.detectedAt,
        price: listing.initialPrice?.toString() || "0.00000000",
      }));
    });

  // Save calendar listing event to database
  private readonly saveCalendarListingEvent = (
    entry: CalendarEntry
  ): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        // Parse symbol to extract baseAsset and quoteAsset
        // MEXC symbols are typically like "BTCUSDT" (no separator)
        let baseAsset = entry.vcoinName || "";
        let quoteAsset = "USDT";

        // Try to extract from symbol if it contains quote asset
        if (entry.symbol) {
          const quoteAssets = ["USDT", "USDC", "BTC", "ETH", "BNB"];
          for (const quote of quoteAssets) {
            if (entry.symbol.endsWith(quote)) {
              baseAsset = entry.symbol.slice(0, -quote.length);
              quoteAsset = quote;
              break;
            }
          }
          // If no quote asset found, use entire symbol as base
          if (!baseAsset) {
            baseAsset = entry.symbol;
          }
        }

        // Get current price if listing is already live
        let initialPrice: string | null = null;
        try {
          const ticker = yield* mexcClient.getTicker(entry.symbol);
          initialPrice = ticker.price;
        } catch {
          // Price fetch failed, listing might not be live yet
          initialPrice = null;
        }

        // Calculate expiresAt (24 hours after listing time)
        const listingTime = new Date(entry.firstOpenTime);
        const expiresAt = new Date(listingTime.getTime() + 24 * 60 * 60 * 1000);

        // Insert listing event with calendar metadata
        yield* Effect.tryPromise({
          try: () =>
            db.insert(listingEvent).values({
              symbol: entry.symbol,
              baseAsset,
              quoteAsset,
              listingTime,
              vcoinId: entry.vcoinId,
              projectName: entry.vcoinNameFull,
              detectionMethod: "CALENDAR",
              initialPrice: initialPrice || null,
              detectedAt: new Date(),
              expiresAt,
            }),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to save calendar listing event: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "DATABASE_ERROR",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        yield* TradingLogger.logInfo(
          `Saved calendar listing event for ${entry.symbol}`,
          {
            vcoinId: entry.vcoinId,
            projectName: entry.vcoinNameFull,
            firstOpenTime: new Date(entry.firstOpenTime).toISOString(),
          }
        );
      } catch (error) {
        // Log error but don't fail the detection process
        yield* TradingLogger.logError(
          `Failed to save calendar listing event for ${entry.symbol}`,
          error as Error
        );
      }
    });
  };

  // Save listing event to database (supports metadata from multi-layer detection)
  private readonly saveListingEvent = (
    symbol: string,
    eventType: string,
    metadata?: {
      vcoinId?: string;
      vcoinName?: string;
      projectName?: string;
      firstOpenTime?: number;
    }
  ): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        // Parse symbol to extract baseAsset and quoteAsset
        // MEXC symbols are typically like "BTCUSDT" (no separator)
        let baseAsset = metadata?.vcoinName || "";
        let quoteAsset = "USDT";

        // Try to extract from symbol if it contains quote asset
        const quoteAssets = ["USDT", "USDC", "BTC", "ETH", "BNB"];
        for (const quote of quoteAssets) {
          if (symbol.endsWith(quote)) {
            baseAsset = baseAsset || symbol.slice(0, -quote.length);
            quoteAsset = quote;
            break;
          }
        }
        // If no quote asset found, use entire symbol as base
        if (!baseAsset) {
          baseAsset = symbol;
        }

        // Get current price for the symbol
        let initialPrice: string | null = null;
        try {
          const ticker = yield* mexcClient.getTicker(symbol);
          initialPrice = ticker.price;
        } catch {
          // Price fetch failed, use null
          initialPrice = null;
        }

        // Determine detection method from event type
        let detectionMethod = "SYMBOL_COMPARISON";
        if (eventType.includes("CALENDAR")) {
          detectionMethod = "CALENDAR";
        } else if (eventType.includes("SYMBOLSV2")) {
          detectionMethod = "SYMBOLSV2";
        } else if (eventType.includes("EXCHANGE_INFO")) {
          detectionMethod = "EXCHANGE_INFO";
        }

        // Calculate expiresAt (24 hours from now, or from firstOpenTime if available)
        const listingTime = metadata?.firstOpenTime
          ? new Date(metadata.firstOpenTime)
          : new Date();
        const expiresAt = metadata?.firstOpenTime
          ? new Date(metadata.firstOpenTime + 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Insert listing event with metadata
        yield* Effect.tryPromise({
          try: () =>
            db.insert(listingEvent).values({
              symbol,
              baseAsset,
              quoteAsset,
              listingTime,
              vcoinId: metadata?.vcoinId || null,
              projectName: metadata?.projectName || null,
              detectionMethod,
              initialPrice: initialPrice || null,
              detectedAt: new Date(),
              expiresAt,
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
          price: initialPrice || "N/A",
          detectionMethod,
          source: metadata?.vcoinId ? "calendar" : "symbol",
        });
      } catch (error) {
        // Log error but don't fail the detection process
        yield* TradingLogger.logError(
          `Failed to save listing event for ${symbol}`,
          error as Error
        );
      }
    });
  };

  // Check if symbol is enabled for trading
  isSymbolEnabled = (symbol: string): Effect.Effect<boolean, MEXCApiError> => {
    return Effect.gen(function* () {
      try {
        const configs = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
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
        return configs.some(
          (config) =>
            config.enabledPairs &&
            Array.isArray(config.enabledPairs) &&
            config.enabledPairs.includes(symbol)
        );
      } catch (error) {
        yield* TradingLogger.logError(
          `Failed to check if symbol ${symbol} is enabled`,
          error as Error
        );
        return false; // Default to not enabled on error
      }
    });
  };

  // Get detector statistics
  getStatistics = (): Effect.Effect<
    {
      knownSymbolsCount: number;
      knownVcoinIdsCount: number;
      lastCheckTime: Date;
      lastCalendarCheckTime: Date;
      uptime: number;
    },
    MEXCApiError
  > =>
    Effect.sync(() => ({
      knownSymbolsCount: this.knownSymbols.size,
      knownVcoinIdsCount: this.knownVcoinIds.size,
      lastCheckTime: new Date(this.lastCheckTime),
      lastCalendarCheckTime: new Date(this.lastCalendarCheckTime),
      uptime:
        Date.now() - (this.lastCheckTime > 0 ? this.lastCheckTime : Date.now()),
    }));
}

// Create layer for dependency injection
export const ListingDetectorLive = Layer.succeed(
  ListingDetectorService,
  new ListingDetector()
);

// Export singleton instance
export const listingDetector = new ListingDetector();
