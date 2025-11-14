import { logger } from "../lib/pino-logger";
import {
  createListingSignal,
  isSignalDuplicate,
} from "./listing-signal-service";

type CalendarEntry = {
  symbol: string;
  listingTime: string;
  [key: string]: unknown;
};

type MexcCalendarResponse = {
  code: number;
  data: {
    newCoins: CalendarEntry[];
  };
};

/**
 * MEXC Calendar Scanner
 * Polls MEXC /api/v3/capital/calendar endpoint for new listings
 * Based on proven working implementation
 */
export class CalendarScanner {
  private readonly baseUrl = "https://www.mexc.com";
  private readonly endpoint = "/api/v3/capital/calendar";
  private readonly timeout = 8000; // 8s timeout

  /**
   * Scan MEXC calendar for new coin listings
   * Returns array of detected symbols
   */
  async scan(): Promise<string[]> {
    const startTime = Date.now();

    try {
      logger.info(
        { event: "calendar_scan_start" },
        "Starting MEXC calendar scan"
      );

      const response = await this.fetchCalendar();

      if (!(response && response.data && response.data.newCoins)) {
        logger.warn(
          { event: "calendar_scan_empty" },
          "No data in calendar response"
        );
        return [];
      }

      const newCoins = response.data.newCoins;
      const detectedSymbols: string[] = [];

      for (const entry of newCoins) {
        const symbol = this.normalizeSymbol(entry.symbol);

        if (!symbol) {
          continue;
        }

        // Check for duplicates
        const isDuplicate = await isSignalDuplicate(symbol, "calendar", 1);
        if (isDuplicate) {
          logger.debug(
            { symbol, source: "calendar" },
            "Skipping duplicate signal"
          );
          continue;
        }

        // Create signal
        const listingTime = entry.listingTime
          ? new Date(entry.listingTime)
          : undefined;
        const freshnessDeadline = new Date(Date.now() + 60_000); // 1 minute freshness

        await createListingSignal({
          symbol,
          detectionSource: "calendar",
          listingTime,
          confidence: "high", // Calendar is authoritative
          freshnessDeadline,
        });

        detectedSymbols.push(symbol);

        logger.info(
          {
            event: "listing_detected",
            symbol,
            source: "calendar",
            listingTime: listingTime?.toISOString(),
          },
          `New listing detected: ${symbol}`
        );
      }

      const duration = Date.now() - startTime;
      logger.info(
        {
          event: "calendar_scan_complete",
          detected: detectedSymbols.length,
          total: newCoins.length,
          duration,
        },
        `Calendar scan complete: ${detectedSymbols.length} new signals`
      );

      return detectedSymbols;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          event: "calendar_scan_error",
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        "Calendar scan failed"
      );

      // Return empty array on error (proven pattern)
      return [];
    }
  }

  /**
   * Fetch calendar data from MEXC
   * Uses proper headers and timeout protection
   */
  private async fetchCalendar(): Promise<MexcCalendarResponse | null> {
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
          "Calendar API returned non-OK status"
        );
        return null;
      }

      const data = (await response.json()) as MexcCalendarResponse;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        logger.warn({ timeout: this.timeout }, "Calendar request timed out");
      } else {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "Calendar fetch failed"
        );
      }

      return null;
    }
  }

  /**
   * Normalize symbol to USDT pair format
   */
  private normalizeSymbol(symbol: string): string | null {
    if (!symbol) {
      return null;
    }

    const normalized = symbol.trim().toUpperCase();

    // Already USDT pair
    if (normalized.endsWith("USDT")) {
      return normalized;
    }

    // Add USDT suffix
    return `${normalized}USDT`;
  }
}

/**
 * Singleton instance
 */
export const calendarScanner = new CalendarScanner();
