/**
 * Calendar Router - Direct MEXC Calendar Data
 *
 * Provides raw calendar data from MEXC API without forecast processing
 */

import { Effect } from "effect";
import { publicProcedure, router } from "../index";
import { type CalendarEntry, mexcClient } from "../services/mexc-client";

export const calendarRouter = router({
  /**
   * Get raw calendar listings from MEXC
   * Returns the actual calendar data without forecast calculations
   */
  getCalendarListings: publicProcedure.query(
    async (): Promise<CalendarEntry[]> => {
      try {
        console.log("[CalendarRouter] Fetching calendar listings...");

        const calendarData = await Effect.runPromise(
          mexcClient.getCalendarListings().pipe(
            Effect.catchAll((error) => {
              console.error("[CalendarRouter] Calendar fetch error:", error);
              // Return empty array on error for graceful degradation
              return Effect.succeed([] as CalendarEntry[]);
            })
          )
        );

        console.log(
          `[CalendarRouter] Retrieved ${calendarData.length} calendar entries`
        );
        return calendarData;
      } catch (error) {
        console.error("[CalendarRouter] Unexpected error:", error);
        // Always return empty array, never throw
        return [];
      }
    }
  ),
});
