import { Effect } from "effect";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import {
  forecastService,
  type UpcomingCoinsResponse,
} from "../services/forecast-service";

const forecastSymbolSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
});

// Response types for serialized data (Date -> string)
type SerializedCoinForecast = {
  symbol: string;
  name: string;
  releaseDate: string; // ISO string
  potential: number;
  forecast: number;
};

type SerializedUpcomingCoinsResponse = {
  today: SerializedCoinForecast[];
  tomorrow: SerializedCoinForecast[];
  all: SerializedCoinForecast[];
};

export const forecastRouter = router({
  getUpcomingCoins: publicProcedure.query(
    async (): Promise<SerializedUpcomingCoinsResponse> => {
      try {
        const result = await Effect.runPromise(
          forecastService.getUpcomingListings().pipe(
            Effect.catchAll((error) => {
              // Log the error but return empty result instead of throwing
              console.error("Forecast service error:", error);
              return Effect.succeed({
                today: [],
                tomorrow: [],
                all: [],
              } as UpcomingCoinsResponse);
            })
          )
        );

        // Convert Date objects to ISO strings for JSON serialization
        const serializeResponse = {
          today: (result.today || []).map((coin) => ({
            ...coin,
            releaseDate: coin.releaseDate.toISOString(),
          })),
          tomorrow: (result.tomorrow || []).map((coin) => ({
            ...coin,
            releaseDate: coin.releaseDate.toISOString(),
          })),
          all: (result.all || []).map((coin) => ({
            ...coin,
            releaseDate: coin.releaseDate.toISOString(),
          })),
        };

        return serializeResponse;
      } catch (error) {
        // Catch any synchronous errors or Effect.runPromise failures
        console.error("Forecast router error:", error);
        return {
          today: [],
          tomorrow: [],
          all: [],
        };
      }
    }
  ),

  getForecast: publicProcedure
    .input(forecastSymbolSchema)
    .query(async ({ input }) => {
      try {
        return await Effect.runPromise(
          forecastService
            .calculateForecast(input.symbol)
            .pipe(Effect.catchAll(() => Effect.succeed(null)))
        );
      } catch (error) {
        console.error("Forecast fetch error:", error);
        return null;
      }
    }),
});
