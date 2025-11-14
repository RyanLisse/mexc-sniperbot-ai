import { CronJob } from "encore.dev/cron";
import { logger } from "../lib/pino-logger";
import { calendarScanner } from "../services/calendar-scanner";
import { tickerScanner } from "../services/ticker-scanner";

/**
 * Listing Scanner Cron Job
 * Runs every 5 seconds to detect new coin listings
 * Only runs when bot is active
 */
export const listingScannerCron = new CronJob("listing-scanner", {
  title: "Listing Scanner",
  every: "5s",
  endpoint: async () => {
    const startTime = Date.now();

    try {
      logger.debug({ event: "scanner_cron_start" }, "Starting listing scan");

      // Run both scanners in parallel
      const [calendarSymbols, tickerSymbols] = await Promise.all([
        calendarScanner.scan(),
        tickerScanner.scan(),
      ]);

      const totalDetected = calendarSymbols.length + tickerSymbols.length;
      const duration = Date.now() - startTime;

      logger.info(
        {
          event: "scanner_cron_complete",
          calendarDetected: calendarSymbols.length,
          tickerDetected: tickerSymbols.length,
          totalDetected,
          duration,
        },
        `Scan complete: ${totalDetected} signals in ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          event: "scanner_cron_error",
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        "Scanner cron job failed"
      );

      // Don't throw - let cron continue
    }
  },
});
