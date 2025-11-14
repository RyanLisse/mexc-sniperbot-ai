import { apiResponse, createSuccessResponse } from "@/lib/api-response";

/**
 * Get calendar listings from MEXC API
 * Matches the working implementation pattern from ex/mexc-sniper-bot
 */
export async function GET() {
  try {
    // Add timeout wrapper for service call
    const calendarResponse = (await Promise.race([
      fetchCalendarListings(),
      new Promise<{ success: boolean; data: unknown[] }>((_, reject) =>
        setTimeout(() => reject(new Error("Service timeout")), 8000)
      ),
    ])) as {
      success: boolean;
      data: unknown[];
      cached?: boolean;
      executionTimeMs?: number;
    };

    // Ensure data is always an array
    const calendarData = Array.isArray(calendarResponse?.data)
      ? calendarResponse.data
      : [];

    return apiResponse(
      createSuccessResponse(calendarData, {
        count: calendarData.length,
        cached: calendarResponse?.cached ?? false,
        executionTimeMs: calendarResponse?.executionTimeMs ?? 0,
        serviceLayer: true,
      })
    );
  } catch (error) {
    console.error("MEXC calendar fetch failed:", { error });

    // Always return empty array with success status to prevent 404/500 errors
    return apiResponse(
      createSuccessResponse([], {
        error:
          error instanceof Error
            ? error.message
            : "Service temporarily unavailable",
        count: 0,
        serviceLayer: true,
        fallback: true,
      })
    );
  }
}

/**
 * Fetch calendar listings directly from MEXC API
 * Uses native fetch with proper headers matching the working implementation
 */
async function fetchCalendarListings(): Promise<{
  success: boolean;
  data: unknown[];
  cached?: boolean;
  executionTimeMs?: number;
}> {
  const startTime = Date.now();

  try {
    const timestamp = Date.now();
    const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;

    // Use native fetch with proper headers and timeout for calendar API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30 second timeout

    try {
      const fetchResponse = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!fetchResponse.ok) {
        throw new Error(
          `Calendar API returned ${fetchResponse.status}: ${fetchResponse.statusText}`
        );
      }

      const data = await fetchResponse.json();

      // Handle the actual MEXC API response structure: data.data.newCoins
      let calendarData: unknown[] = [];

      if (data?.data?.newCoins && Array.isArray(data.data.newCoins)) {
        calendarData = data.data.newCoins
          .filter(
            (entry: unknown): entry is Record<string, unknown> =>
              typeof entry === "object" &&
              entry !== null &&
              "vcoinId" in entry &&
              Boolean(entry.vcoinId) &&
              "vcoinName" in entry &&
              Boolean(entry.vcoinName) &&
              "firstOpenTime" in entry &&
              Boolean(entry.firstOpenTime)
          )
          .map((entry: Record<string, unknown>) => ({
            vcoinId: String(entry.vcoinId),
            symbol: String(entry.vcoinName), // MEXC uses vcoinName for symbol
            projectName: String(entry.vcoinNameFull || entry.vcoinName), // MEXC uses vcoinNameFull for full project name
            firstOpenTime: Number(entry.firstOpenTime),
            vcoinName: entry.vcoinName ? String(entry.vcoinName) : undefined,
            vcoinNameFull: entry.vcoinNameFull
              ? String(entry.vcoinNameFull)
              : undefined,
            zone: entry.zone ? String(entry.zone) : undefined,
          }));
      }
      // Fallback: check if data is directly an array (for backward compatibility)
      else if (data?.data && Array.isArray(data.data)) {
        calendarData = data.data
          .filter(
            (entry: unknown): entry is Record<string, unknown> =>
              typeof entry === "object" &&
              entry !== null &&
              "vcoinId" in entry &&
              Boolean(entry.vcoinId) &&
              "symbol" in entry &&
              Boolean(entry.symbol) &&
              "firstOpenTime" in entry &&
              Boolean(entry.firstOpenTime)
          )
          .map((entry: Record<string, unknown>) => ({
            vcoinId: String(entry.vcoinId),
            symbol: String(entry.symbol),
            projectName: String(entry.projectName || entry.symbol),
            firstOpenTime: Number(entry.firstOpenTime),
            vcoinName: entry.vcoinName ? String(entry.vcoinName) : undefined,
            vcoinNameFull: entry.vcoinNameFull
              ? String(entry.vcoinNameFull)
              : undefined,
            zone: entry.zone ? String(entry.zone) : undefined,
          }));
      }

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        data: calendarData,
        cached: false,
        executionTimeMs,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error("Calendar API request timeout");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("[Calendar API] Calendar listings failed:", error);
    return {
      success: false,
      data: [],
      cached: false,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
