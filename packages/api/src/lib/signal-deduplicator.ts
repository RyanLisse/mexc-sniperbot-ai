import type { DetectionSource } from "../services/listing-signal-service";
import { isSignalDuplicate } from "../services/listing-signal-service";
import { logger } from "./pino-logger";

/**
 * Signal Deduplicator
 * Prevents duplicate signals within configurable time window
 */
export class SignalDeduplicator {
  private readonly defaultWindow = 1; // 1 minute default

  /**
   * Check if signal should be deduplicated
   * Returns true if signal is a duplicate and should be skipped
   */
  async shouldDeduplicate(
    symbol: string,
    source: DetectionSource,
    windowMinutes = this.defaultWindow
  ): Promise<boolean> {
    try {
      const isDuplicate = await isSignalDuplicate(
        symbol,
        source,
        windowMinutes
      );

      if (isDuplicate) {
        logger.debug(
          {
            symbol,
            source,
            windowMinutes,
          },
          `Duplicate signal detected within ${windowMinutes}min window`
        );
      }

      return isDuplicate;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          symbol,
          source,
        },
        "Error checking signal deduplication"
      );

      // On error, allow signal through (fail open)
      return false;
    }
  }

  /**
   * Check multiple symbols for deduplication
   * Returns array of non-duplicate symbols
   */
  async filterDuplicates(
    symbols: string[],
    source: DetectionSource,
    windowMinutes = this.defaultWindow
  ): Promise<string[]> {
    const uniqueSymbols: string[] = [];

    for (const symbol of symbols) {
      const isDuplicate = await this.shouldDeduplicate(
        symbol,
        source,
        windowMinutes
      );
      if (!isDuplicate) {
        uniqueSymbols.push(symbol);
      }
    }

    logger.debug(
      {
        total: symbols.length,
        unique: uniqueSymbols.length,
        duplicates: symbols.length - uniqueSymbols.length,
        source,
      },
      "Filtered duplicate signals"
    );

    return uniqueSymbols;
  }
}

/**
 * Singleton instance
 */
export const signalDeduplicator = new SignalDeduplicator();
