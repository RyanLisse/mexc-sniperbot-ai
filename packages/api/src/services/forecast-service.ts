import { Effect } from "effect";
import {
  type DatabaseError,
  type MEXCApiError,
  TradingLogger,
} from "../lib/effect";
import {
  filterListingsByTimeWindow,
  filterTodaysListings,
  filterTomorrowsListings,
} from "./calendar-utils";
import { mexcClient } from "./mexc-client";

export type CoinForecast = {
  symbol: string;
  name: string;
  releaseDate: Date;
  potential: number; // 1-5 stars
  forecast: number; // Percentage change (+/-)
};

export type UpcomingCoinsResponse = {
  today: CoinForecast[];
  tomorrow: CoinForecast[];
  all: CoinForecast[];
};

export const forecastService = {
  getUpcomingListings(): Effect.Effect<
    UpcomingCoinsResponse,
    DatabaseError | MEXCApiError
  > {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Fetching upcoming listings for forecast");

      // Get calendar listings from MEXC API
      // getCalendarListings already returns empty array on failure, so we can use it directly
      const calendarEntries = yield* mexcClient.getCalendarListings();

      // Ensure we have an array (fallback to empty array if undefined/null)
      if (!Array.isArray(calendarEntries) || calendarEntries.length === 0) {
        yield* TradingLogger.logInfo(
          "No calendar listings available, returning empty forecast"
        );
        return {
          today: [],
          tomorrow: [],
          all: [],
        };
      }

      // Filter to get upcoming listings (next 7 days)
      const upcomingEntries = filterListingsByTimeWindow(calendarEntries, 168); // 7 days

      // Generate forecasts for each listing
      const forecasts: CoinForecast[] = upcomingEntries
        .filter((entry) => {
          // Filter out invalid entries
          if (!entry.symbol) {
            return false;
          }
          if (!entry.firstOpenTime) {
            return false;
          }
          // Ensure firstOpenTime is valid (not 0 or invalid date)
          const date = new Date(entry.firstOpenTime);
          const isValidDate = !Number.isNaN(date.getTime());
          const isPositive = date.getTime() > 0;
          return isValidDate && isPositive;
        })
        .map((entry) => {
          // Calculate potential based on project name and symbol
          // More established projects get higher potential
          const projectName = entry.vcoinNameFull || entry.vcoinName || "";
          const symbol = entry.symbol || "";

          // Mock potential calculation (in production, use ML models)
          // Factors: project name length, symbol popularity, etc.
          let potential = 3; // Default 3 stars
          if (projectName.length > 10) {
            potential = 4; // Longer names suggest more established projects
          }
          if (symbol.includes("AI") || symbol.includes("GPT")) {
            potential = 5; // AI-related tokens tend to perform well
          } else if (symbol.length < 6) {
            potential = 4; // Shorter symbols often perform better
          }

          // Mock forecast calculation (in production, use historical data and ML)
          // Base forecast: -5% to +25% with some variance
          const baseForecast = Math.random() * 30 - 5; // -5% to +25%
          const forecast = Math.round(baseForecast * 100) / 100;

          return {
            symbol: entry.symbol,
            name:
              entry.vcoinNameFull ||
              entry.vcoinName ||
              entry.symbol.replace("USDT", ""),
            releaseDate: new Date(entry.firstOpenTime),
            potential,
            forecast,
          };
        });

      // Separate by today and tomorrow using calendar utils
      const todayEntries = filterTodaysListings(calendarEntries);
      const tomorrowEntries = filterTomorrowsListings(calendarEntries);

      const todayForecasts = forecasts.filter((f) =>
        todayEntries.some((e) => e.symbol === f.symbol)
      );

      const tomorrowForecasts = forecasts.filter((f) =>
        tomorrowEntries.some((e) => e.symbol === f.symbol)
      );

      yield* TradingLogger.logInfo("Upcoming listings forecast generated", {
        total: forecasts.length,
        today: todayForecasts.length,
        tomorrow: tomorrowForecasts.length,
      });

      return {
        today: todayForecasts,
        tomorrow: tomorrowForecasts,
        all: forecasts,
      };
    });
  },

  calculateForecast(
    symbol: string
  ): Effect.Effect<CoinForecast | null, DatabaseError | MEXCApiError> {
    return Effect.gen(function* () {
      const upcoming = yield* forecastService.getUpcomingListings();
      return (
        upcoming.all.find((f: CoinForecast) => f.symbol === symbol) ?? null
      );
    });
  },

  getListingSchedule(): Effect.Effect<
    UpcomingCoinsResponse,
    DatabaseError | MEXCApiError
  > {
    return this.getUpcomingListings();
  },
};
