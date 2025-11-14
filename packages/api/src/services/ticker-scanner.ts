import { logger } from "../lib/pino-logger";
import {
  createListingSignal,
  isSignalDuplicate,
} from "./listing-signal-service";

type TickerEntry = {
  symbol: string;
  [key: string]: unknown;
};

type MexcTickerResponse = {
  symbol: string;
  [key: string]: unknown;
}[];

/**
 * Ticker Diff Scanner
 * Detects new listings by comparing current vs previous ticker symbols
 */
export class TickerScanner {
  private readonly baseUrl = "https://api.mexc.com";
  private readonly endpoint = "/api/v3/ticker/24hr";
  private readonly timeout = 8000;

  private previousSymbols = new Set<string>();
  private isInitialized = false;

  /**
   * Scan for new symbols by comparing with previous snapshot
   * Returns array of newly detected symbols
   */
  async scan(): Promise<string[]> {
    const startTime = Date.now();

    try {
      logger.info({ event: "ticker_scan_start" }, "Starting ticker diff scan");

      const tickers = await this.fetchTickers();

      if (!tickers || tickers.length === 0) {
        logger.warn({ event: "ticker_scan_empty" }, "No tickers in response");
        return [];
      }

      const currentSymbols = new Set(
        tickers.map((t) => t.symbol).filter((s) => s && s.endsWith("USDT"))
      );

      // First run - just store symbols
      if (!this.isInitialized) {
        this.previousSymbols = currentSymbols;
        this.isInitialized = true;

        logger.info(
          {
            event: "ticker_scan_initialized",
            symbolCount: currentSymbols.size,
          },
          `Initialized with ${currentSymbols.size} symbols`
        );

        return [];
      }

      // Find new symbols
      const newSymbols = Array.from(currentSymbols).filter(
        (symbol) => !this.previousSymbols.has(symbol)
      );

      const detectedSymbols: string[] = [];

      for (const symbol of newSymbols) {
        // Check for duplicates
        const isDuplicate = await isSignalDuplicate(symbol, "ticker_diff", 1);
        if (isDuplicate) {
          logger.debug(
            { symbol, source: "ticker_diff" },
            "Skipping duplicate signal"
          );
          continue;
        }

        // Create signal with medium confidence (less authoritative than calendar)
        const freshnessDeadline = new Date(Date.now() + 60_000); // 1 minute

        await createListingSignal({
          symbol,
          detectionSource: "ticker_diff",
          confidence: "medium",
          freshnessDeadline,
        });

        detectedSymbols.push(symbol);

        logger.info(
          {
            event: "listing_detected",
            symbol,
            source: "ticker_diff",
          },
          `New listing detected via ticker diff: ${symbol}`
        );
      }

      // Update previous symbols
      this.previousSymbols = currentSymbols;

      const duration = Date.now() - startTime;
      logger.info(
        {
          event: "ticker_scan_complete",
          detected: detectedSymbols.length,
          newSymbols: newSymbols.length,
          totalSymbols: currentSymbols.size,
          duration,
        },
        `Ticker scan complete: ${detectedSymbols.length} new signals`
      );

      return detectedSymbols;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          event: "ticker_scan_error",
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        "Ticker scan failed"
      );

      return [];
    }
  }

  /**
   * Fetch ticker data from MEXC
   */
  private async fetchTickers(): Promise<MexcTickerResponse | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseUrl}${this.endpoint}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          {
            status: response.status,
            statusText: response.statusText,
          },
          "Ticker API returned non-OK status"
        );
        return null;
      }

      const data = (await response.json()) as MexcTickerResponse;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        logger.warn({ timeout: this.timeout }, "Ticker request timed out");
      } else {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "Ticker fetch failed"
        );
      }

      return null;
    }
  }

  /**
   * Reset scanner state (useful for testing)
   */
  reset(): void {
    this.previousSymbols.clear();
    this.isInitialized = false;
    logger.info({ event: "ticker_scanner_reset" }, "Scanner state reset");
  }
}

/**
 * Singleton instance
 */
export const tickerScanner = new TickerScanner();
