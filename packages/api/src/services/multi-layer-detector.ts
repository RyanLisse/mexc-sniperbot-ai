/**
 * Multi-Layer Fallback Strategy for Listing Detection
 *
 * Layer 1: Calendar API (30s intervals) - Primary detection
 * Layer 2: SymbolsV2 pattern detection (15s intervals) - sts:2, st:2, tt:4
 * Layer 3: Exchange info polling (60s intervals)
 * Layer 4: WebSocket monitoring (real-time) - Future implementation
 */

import { Effect } from "effect";
import { MEXCApiError, TradingLogger } from "../lib/effect";
import { mexcClient } from "./mexc-client";

// Detection intervals (in milliseconds)
const CALENDAR_API_INTERVAL = 30_000; // 30 seconds
const SYMBOLSV2_INTERVAL = 15_000; // 15 seconds
const EXCHANGE_INFO_INTERVAL = 60_000; // 60 seconds

// SymbolsV2 pattern detection parameters
const SYMBOLSV2_PARAMS = {
  sts: "2", // Status filter: 2 = trading
  st: "2", // Status type: 2 = trading
  tt: "4", // Trading type: 4 = spot
} as const;

export type DetectedListing = {
  symbol: string;
  source: "calendar" | "symbolsv2" | "exchange_info" | "websocket";
  detectedAt: number;
  metadata?: {
    vcoinId?: string;
    vcoinName?: string;
    projectName?: string;
    firstOpenTime?: number;
  };
};

export class MultiLayerDetector {
  private readonly knownSymbols = new Set<string>();
  private readonly knownVcoinIds = new Set<string>();
  private lastCalendarCheck = 0;
  private lastSymbolsv2Check = 0;
  private lastExchangeInfoCheck = 0;

  /**
   * Layer 1: Calendar API Detection (30s intervals)
   * Primary detection method using MEXC calendar endpoint
   */
  detectViaCalendar = (): Effect.Effect<DetectedListing[], MEXCApiError> => {
    return Effect.gen(function* () {
      const now = Date.now();

      // Rate limiting: don't check more frequently than every 30 seconds
      if (now - this.lastCalendarCheck < CALENDAR_API_INTERVAL) {
        yield* TradingLogger.logDebug(
          "Skipping calendar detection - rate limited"
        );
        return [];
      }

      yield* TradingLogger.logDebug("Layer 1: Calendar API detection");

      try {
        const calendarEntries = yield* mexcClient.getCalendarListings();
        const newListings: DetectedListing[] = [];

        for (const entry of calendarEntries) {
          // Check if this is a new vcoinId or symbol
          const isNewVcoinId =
            entry.vcoinId && !this.knownVcoinIds.has(entry.vcoinId);
          const isNewSymbol =
            entry.symbol && !this.knownSymbols.has(entry.symbol);

          if (isNewVcoinId || isNewSymbol) {
            // Add to known sets
            if (entry.vcoinId) {
              this.knownVcoinIds.add(entry.vcoinId);
            }
            if (entry.symbol) {
              this.knownSymbols.add(entry.symbol);
            }

            newListings.push({
              symbol: entry.symbol,
              source: "calendar",
              detectedAt: now,
              metadata: {
                vcoinId: entry.vcoinId,
                vcoinName: entry.vcoinName,
                projectName: entry.vcoinNameFull,
                firstOpenTime: entry.firstOpenTime,
              },
            });
          }
        }

        this.lastCalendarCheck = now;

        if (newListings.length > 0) {
          yield* TradingLogger.logInfo(
            `Layer 1: Detected ${newListings.length} new calendar listings`
          );
        }

        return newListings;
      } catch (error) {
        yield* TradingLogger.logError(
          "Layer 1: Calendar API detection failed",
          error instanceof MEXCApiError ? error : new Error(String(error))
        );
        return [];
      }
    });
  };

  /**
   * Layer 2: SymbolsV2 Pattern Detection (15s intervals)
   * Detects new listings by checking symbols with specific status patterns
   * Parameters: sts:2, st:2, tt:4
   */
  detectViaSymbolsv2 = (): Effect.Effect<DetectedListing[], MEXCApiError> => {
    return Effect.gen(function* () {
      const now = Date.now();

      // Rate limiting: don't check more frequently than every 15 seconds
      if (now - this.lastSymbolsv2Check < SYMBOLSV2_INTERVAL) {
        yield* TradingLogger.logDebug(
          "Skipping SymbolsV2 detection - rate limited"
        );
        return [];
      }

      yield* TradingLogger.logDebug("Layer 2: SymbolsV2 pattern detection");

      try {
        // Get symbols with trading status (sts:2, st:2, tt:4)
        // Note: This uses the exchangeInfo endpoint filtered by status
        const symbols = yield* mexcClient.getSymbols();
        const newListings: DetectedListing[] = [];

        // Filter symbols by trading status (status === "TRADING")
        const tradingSymbols = symbols.filter(
          (symbol) => symbol.status === "TRADING"
        );

        for (const symbol of tradingSymbols) {
          // Check if this is a new symbol
          if (!this.knownSymbols.has(symbol.symbol)) {
            this.knownSymbols.add(symbol.symbol);

            newListings.push({
              symbol: symbol.symbol,
              source: "symbolsv2",
              detectedAt: now,
              metadata: {
                vcoinName: symbol.baseAsset,
              },
            });
          }
        }

        this.lastSymbolsv2Check = now;

        if (newListings.length > 0) {
          yield* TradingLogger.logInfo(
            `Layer 2: Detected ${newListings.length} new symbols via SymbolsV2 pattern`
          );
        }

        return newListings;
      } catch (error) {
        yield* TradingLogger.logError(
          "Layer 2: SymbolsV2 detection failed",
          error instanceof MEXCApiError ? error : new Error(String(error))
        );
        return [];
      }
    });
  };

  /**
   * Layer 3: Exchange Info Polling (60s intervals)
   * Fallback detection by polling exchange info for new symbols
   */
  detectViaExchangeInfo = (): Effect.Effect<
    DetectedListing[],
    MEXCApiError
  > => {
    return Effect.gen(function* () {
      const now = Date.now();

      // Rate limiting: don't check more frequently than every 60 seconds
      if (now - this.lastExchangeInfoCheck < EXCHANGE_INFO_INTERVAL) {
        yield* TradingLogger.logDebug(
          "Skipping exchange info detection - rate limited"
        );
        return [];
      }

      yield* TradingLogger.logDebug("Layer 3: Exchange info polling");

      try {
        const symbols = yield* mexcClient.getSymbols();
        const newListings: DetectedListing[] = [];

        for (const symbol of symbols) {
          // Check if this is a new symbol
          if (!this.knownSymbols.has(symbol.symbol)) {
            this.knownSymbols.add(symbol.symbol);

            newListings.push({
              symbol: symbol.symbol,
              source: "exchange_info",
              detectedAt: now,
              metadata: {
                vcoinName: symbol.baseAsset,
              },
            });
          }
        }

        this.lastExchangeInfoCheck = now;

        if (newListings.length > 0) {
          yield* TradingLogger.logInfo(
            `Layer 3: Detected ${newListings.length} new symbols via exchange info`
          );
        }

        return newListings;
      } catch (error) {
        yield* TradingLogger.logError(
          "Layer 3: Exchange info detection failed",
          error instanceof MEXCApiError ? error : new Error(String(error))
        );
        return [];
      }
    });
  };

  /**
   * Multi-layer detection: Try all layers and combine results
   * Returns deduplicated list of new listings from all sources
   */
  detectAllLayers = (): Effect.Effect<DetectedListing[], MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Starting multi-layer detection");

      // Run all detection layers in parallel
      const [calendarResults, symbolsv2Results, exchangeInfoResults] =
        yield* Effect.all([
          this.detectViaCalendar(),
          this.detectViaSymbolsv2(),
          this.detectViaExchangeInfo(),
        ]);

      // Combine and deduplicate by symbol
      const allResults = [
        ...calendarResults,
        ...symbolsv2Results,
        ...exchangeInfoResults,
      ];

      // Deduplicate by symbol (prefer calendar source if duplicate)
      const uniqueListings = new Map<string, DetectedListing>();
      for (const listing of allResults) {
        const existing = uniqueListings.get(listing.symbol);
        if (!existing || existing.source !== "calendar") {
          // Prefer calendar source, or use the first one found
          uniqueListings.set(listing.symbol, listing);
        }
      }

      const deduplicated = Array.from(uniqueListings.values());

      if (deduplicated.length > 0) {
        yield* TradingLogger.logInfo(
          `Multi-layer detection found ${deduplicated.length} unique new listings (Calendar: ${calendarResults.length}, SymbolsV2: ${symbolsv2Results.length}, ExchangeInfo: ${exchangeInfoResults.length})`
        );
      }

      return deduplicated;
    });
  };

  /**
   * Initialize detector with existing symbols
   */
  initialize = (): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Initializing multi-layer detector");

      // Initialize with existing symbols
      const symbols = yield* mexcClient.getSymbols();
      symbols.forEach((symbol) => {
        this.knownSymbols.add(symbol.symbol);
      });

      // Initialize with calendar listings
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
      } catch (error) {
        yield* TradingLogger.logDebug(
          "Failed to initialize calendar listings, continuing with symbols only"
        );
      }

      yield* TradingLogger.logInfo(
        `Initialized with ${this.knownSymbols.size} known symbols and ${this.knownVcoinIds.size} known vcoinIds`
      );
    });
  };
}

// Export singleton instance
export const multiLayerDetector = new MultiLayerDetector();
