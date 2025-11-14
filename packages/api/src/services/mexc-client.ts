import { createHmac } from "node:crypto";
import axios from "axios";
import { Effect } from "effect";
import { createCircuitBreakerForEffect } from "../lib/circuit-breaker";
import {
  MEXCApiError,
  TradingLogger,
  withLogging,
  withRetry,
} from "../lib/effect";
import { getMEXCConfig } from "../lib/env";
import { pooledHttpClient } from "../lib/http-client";
import {
  apiErrors,
  orderLatency,
  tradesTotal,
} from "../services/metrics-collector";
import { mexcRateLimiter, withRateLimit } from "../services/rate-limiter";

// MEXC API types
export type MEXCSymbol = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
};

export type MEXCTicker = {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  timestamp: number;
};

export type MEXCOrderResponse = {
  orderId: string;
  symbol: string;
  status: string;
  type: string;
  side: string;
  quantity: string;
  price?: string;
  executedQuantity: string;
  executedPrice?: string;
  createTime: number;
  updateTime: number;
};

export type MEXCAccountInfo = {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
};

// Calendar API types
export type CalendarEntry = {
  vcoinId: string;
  symbol: string;
  vcoinName: string;
  vcoinNameFull: string;
  firstOpenTime: number; // Timestamp in milliseconds
  zone?: string;
};

// MEXC API Client class
export class MEXCApiClient {
  private readonly config = getMEXCConfig();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly baseUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
    this.secretKey = this.config.secretKey;
  }

  // Generate HMAC SHA256 signature for authenticated requests
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateSignature(queryString: string): string {
    return createHmac("sha256", this.secretKey)
      .update(queryString)
      .digest("hex");
  }

  // Make authenticated API request with connection pooling, rate limiting, and circuit breaker
  private readonly makeAuthenticatedRequest = <T>(
    endpoint: string,
    params: Record<string, string> = {},
    method: "GET" | "POST" | "DELETE" = "GET"
  ): Effect.Effect<T, MEXCApiError> => {
    const baseRequest = Effect.gen(
      function* (this: MEXCApiClient) {
        const timestamp = Date.now().toString();
        const queryString = new URLSearchParams({
          ...params,
          timestamp,
          recvWindow: "5000",
        }).toString();

        const signature = this.generateSignature(queryString);
        const axiosInstance = pooledHttpClient.getInstance();

        const headers = {
          "X-MEXC-APIKEY": this.apiKey,
          "Content-Type": "application/json",
        };

        const response = yield* Effect.tryPromise({
          try: () => {
            const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
            if (method === "POST") {
              return axiosInstance.post<T>(url, {}, { headers });
            }
            if (method === "DELETE") {
              return axiosInstance.delete<T>(url, { headers });
            }
            // For GET requests
            return axiosInstance.get<T>(url, { headers });
          },
          catch: (error) => {
            // Track API errors
            if (axios.isAxiosError(error)) {
              const statusCode = error.response?.status ?? 0;
              apiErrors.inc({ endpoint, status_code: statusCode.toString() });
              return new MEXCApiError({
                message: `API request failed: ${error.message}`,
                code: "API_REQUEST_FAILED",
                statusCode,
                timestamp: new Date(),
              });
            }
            apiErrors.inc({ endpoint, status_code: "0" });
            return new MEXCApiError({
              message: `API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "API_REQUEST_FAILED",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        if (response.status < 200 || response.status >= 300) {
          apiErrors.inc({ endpoint, status_code: response.status.toString() });
          throw new MEXCApiError({
            message: `API error: ${response.status} ${response.statusText} - ${JSON.stringify(response.data)}`,
            code: `API_ERROR_${response.status}`,
            statusCode: response.status,
            timestamp: new Date(),
          });
        }

        return response.data;
      }.bind(this)
    );

    // Apply rate limiting, circuit breaker, retry, and logging
    return (baseRequest as Effect.Effect<T, MEXCApiError>).pipe(
      (effect: Effect.Effect<T, MEXCApiError>) =>
        withRateLimit(effect, mexcRateLimiter) as Effect.Effect<
          T,
          MEXCApiError
        >,
      (effect: Effect.Effect<T, MEXCApiError>) =>
        createCircuitBreakerForEffect(() => effect) as Effect.Effect<
          T,
          MEXCApiError
        >,
      withRetry,
      (effect: Effect.Effect<T, MEXCApiError>) =>
        withLogging(effect, `MEXC API: ${endpoint}`) as Effect.Effect<
          T,
          MEXCApiError
        >
    );
  };

  // Make public API request (no authentication required) with connection pooling, rate limiting, and circuit breaker
  private readonly makePublicRequest = <T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Effect.Effect<T, MEXCApiError> => {
    const baseRequest = Effect.gen(
      function* (this: MEXCApiClient) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

        const axiosInstance = pooledHttpClient.getInstance();

        const response = yield* Effect.tryPromise({
          try: () =>
            axiosInstance.get<T>(url, {
              headers: {
                "Content-Type": "application/json",
              },
            }),
          catch: (error) => {
            if (axios.isAxiosError(error)) {
              const statusCode = error.response?.status ?? 0;
              apiErrors.inc({ endpoint, status_code: statusCode.toString() });
              return new MEXCApiError({
                message: `Public API request failed: ${error.message}`,
                code: "PUBLIC_API_REQUEST_FAILED",
                statusCode,
                timestamp: new Date(),
              });
            }
            apiErrors.inc({ endpoint, status_code: "0" });
            return new MEXCApiError({
              message: `Public API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "PUBLIC_API_REQUEST_FAILED",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        if (response.status < 200 || response.status >= 300) {
          apiErrors.inc({ endpoint, status_code: response.status.toString() });
          throw new MEXCApiError({
            message: `Public API error: ${response.status} ${response.statusText} - ${JSON.stringify(response.data)}`,
            code: `PUBLIC_API_ERROR_${response.status}`,
            statusCode: response.status,
            timestamp: new Date(),
          });
        }

        return response.data;
      }.bind(this)
    );

    // Apply rate limiting, circuit breaker, retry, and logging
    return (baseRequest as Effect.Effect<T, MEXCApiError>).pipe(
      (effect: Effect.Effect<T, MEXCApiError>) =>
        withRateLimit(effect, mexcRateLimiter) as Effect.Effect<
          T,
          MEXCApiError
        >,
      (effect: Effect.Effect<T, MEXCApiError>) =>
        createCircuitBreakerForEffect(() => effect) as Effect.Effect<
          T,
          MEXCApiError
        >,
      withRetry,
      (effect: Effect.Effect<T, MEXCApiError>) =>
        withLogging(effect, `MEXC Public API: ${endpoint}`) as Effect.Effect<
          T,
          MEXCApiError
        >
    );
  };

  // Get all available symbols
  getSymbols = (): Effect.Effect<MEXCSymbol[], MEXCApiError> =>
    this.makePublicRequest<MEXCSymbol[]>("/api/v3/exchangeInfo");

  // Get ticker information for a symbol
  getTicker = (symbol: string): Effect.Effect<MEXCTicker, MEXCApiError> =>
    this.makePublicRequest<MEXCTicker[]>("/api/v3/ticker/price", {
      symbol,
    }).pipe(
      Effect.flatMap((tickers: MEXCTicker[]) => {
        if (!tickers || tickers.length === 0 || !tickers[0]) {
          return Effect.fail(
            new MEXCApiError({
              message: `No ticker data found for symbol ${symbol}`,
              code: "TICKER_NOT_FOUND",
              statusCode: 404,
              timestamp: new Date(),
            })
          );
        }
        return Effect.succeed(tickers[0]!);
      }),
      Effect.mapError(
        (error: MEXCApiError) =>
          new MEXCApiError({
            ...error,
            message: `Failed to get ticker for ${symbol}: ${error.message}`,
          })
      )
    );

  // Get account information
  getAccountInfo = (): Effect.Effect<MEXCAccountInfo, MEXCApiError> =>
    this.makeAuthenticatedRequest<MEXCAccountInfo>("/api/v3/account");

  // Place a market buy order with metrics instrumentation
  placeMarketBuyOrder = (
    symbol: string,
    quantity: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    const orderEffect = this.makeAuthenticatedRequest<MEXCOrderResponse>(
      "/api/v3/order",
      {
        symbol,
        side: "BUY",
        type: "MARKET",
        quantity,
      },
      "POST"
    );

    // Instrument with metrics
    return Effect.gen(function* () {
      const start = Date.now();
      try {
        const result = yield* orderEffect;
        const latency = Date.now() - start;
        // Track metrics
        orderLatency.observe({ symbol, order_type: "market" }, latency);
        tradesTotal.inc({ symbol, side: "buy", status: result.status });
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "market" }, latency);
        tradesTotal.inc({ symbol, side: "buy", status: "failed" });
        throw error;
      }
    }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to place market buy order for ${symbol}: ${error.message}`,
          })
      )
    );
  };

  // Place a limit buy order with metrics instrumentation
  placeLimitBuyOrder = (
    symbol: string,
    quantity: string,
    price: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    const orderEffect = this.makeAuthenticatedRequest<MEXCOrderResponse>(
      "/api/v3/order",
      {
        symbol,
        side: "BUY",
        type: "LIMIT",
        quantity,
        price,
        timeInForce: "GTC", // Good Till Cancelled
      },
      "POST"
    );

    // Instrument with metrics
    return Effect.gen(function* () {
      const start = Date.now();
      try {
        const result = yield* orderEffect;
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "limit" }, latency);
        tradesTotal.inc({ symbol, side: "buy", status: result.status });
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "limit" }, latency);
        tradesTotal.inc({ symbol, side: "buy", status: "failed" });
        throw error;
      }
    }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to place limit buy order for ${symbol}: ${error.message}`,
          })
      )
    );
  };

  // Check order status
  getOrderStatus = (
    symbol: string,
    orderId: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> =>
    this.makeAuthenticatedRequest<MEXCOrderResponse>("/api/v3/order", {
      symbol,
      orderId,
    }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to get order status for ${orderId}: ${error.message}`,
          })
      )
    );

  // Place a market sell order with metrics instrumentation
  placeMarketSellOrder = (
    symbol: string,
    quantity: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    const orderEffect = this.makeAuthenticatedRequest<MEXCOrderResponse>(
      "/api/v3/order",
      {
        symbol,
        side: "SELL",
        type: "MARKET",
        quantity,
      },
      "POST"
    );

    // Instrument with metrics
    return Effect.gen(function* () {
      const start = Date.now();
      try {
        const result = yield* orderEffect;
        const latency = Date.now() - start;
        // Track metrics
        orderLatency.observe({ symbol, order_type: "market" }, latency);
        tradesTotal.inc({ symbol, side: "sell", status: result.status });
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "market" }, latency);
        tradesTotal.inc({ symbol, side: "sell", status: "failed" });
        throw error;
      }
    }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to place market sell order for ${symbol}: ${error.message}`,
          })
      )
    );
  };

  // Place a limit sell order with metrics instrumentation
  placeLimitSellOrder = (
    symbol: string,
    quantity: string,
    price: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    const orderEffect = this.makeAuthenticatedRequest<MEXCOrderResponse>(
      "/api/v3/order",
      {
        symbol,
        side: "SELL",
        type: "LIMIT",
        quantity,
        price,
        timeInForce: "GTC", // Good Till Cancelled
      },
      "POST"
    );

    // Instrument with metrics
    return Effect.gen(function* () {
      const start = Date.now();
      try {
        const result = yield* orderEffect;
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "limit" }, latency);
        tradesTotal.inc({ symbol, side: "sell", status: result.status });
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        orderLatency.observe({ symbol, order_type: "limit" }, latency);
        tradesTotal.inc({ symbol, side: "sell", status: "failed" });
        throw error;
      }
    }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to place limit sell order for ${symbol}: ${error.message}`,
          })
      )
    );
  };

  // Get open orders for a symbol or all symbols
  getOpenOrders = (
    symbol?: string
  ): Effect.Effect<MEXCOrderResponse[], MEXCApiError> => {
    const params = symbol ? { symbol } : {};
    return this.makeAuthenticatedRequest<MEXCOrderResponse[]>(
      "/api/v3/openOrders",
      params
    ).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to get open orders${symbol ? ` for ${symbol}` : ""}: ${error.message}`,
          })
      )
    );
  };

  // Cancel an order
  cancelOrder = (
    symbol: string,
    orderId: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> =>
    this.makeAuthenticatedRequest<MEXCOrderResponse>(
      "/api/v3/order",
      {
        symbol,
        orderId,
      },
      "DELETE"
    ).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to cancel order ${orderId}: ${error.message}`,
          })
      )
    );

  // Get recent trades for a symbol (useful for detecting new listings)
  getRecentTrades = (
    symbol: string,
    limit = 500
  ): Effect.Effect<
    Array<{
      id: string;
      price: string;
      qty: string;
      time: number;
      isBuyerMaker: boolean;
    }>,
    MEXCApiError
  > =>
    this.makePublicRequest<
      Array<{
        id: string;
        price: string;
        qty: string;
        time: number;
        isBuyerMaker: boolean;
      }>
    >("/api/v3/trades", { symbol, limit: limit.toString() }).pipe(
      Effect.mapError(
        (error) =>
          new MEXCApiError({
            ...error,
            message: `Failed to get recent trades for ${symbol}: ${error.message}`,
          })
      )
    );

  // Get server time (useful for timestamp synchronization)
  getServerTime = (): Effect.Effect<{ serverTime: number }, MEXCApiError> =>
    this.makePublicRequest<{ serverTime: number }>("/api/v3/time");

  // Get calendar listings from MEXC (upcoming coin launches)
  // Primary Detection: https://www.mexc.com/api/operation/new_coin_calendar?timestamp=
  // Uses native fetch with proper headers and timeout (matching working implementation)
  getCalendarListings = (): Effect.Effect<CalendarEntry[], MEXCApiError> => {
    return Effect.gen(function* () {
      // Use current timestamp in milliseconds for proper parameter handling
      const timestamp = Date.now();
      const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;

      yield* TradingLogger.logDebug(
        `Fetching calendar listings from primary endpoint: ${url}`
      );

      // Use native fetch with AbortController for timeout (matching working implementation)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30 second timeout

      try {
        const fetchResponse = yield* Effect.tryPromise({
          try: () =>
            fetch(url, {
              method: "GET",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "application/json",
                "Accept-Language": "en-US,en;q=0.9",
                Referer: "https://www.mexc.com/",
                Origin: "https://www.mexc.com",
              },
              signal: controller.signal,
            }),
          catch: (error) => {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
              return new MEXCApiError({
                message: "Calendar API request timeout after 30s",
                code: "REQUEST_TIMEOUT",
                statusCode: 0,
                timestamp: new Date(),
              });
            }
            return new MEXCApiError({
              message: `Calendar API fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "EXTERNAL_API_REQUEST_FAILED",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        clearTimeout(timeoutId);

        if (!fetchResponse.ok) {
          // Try to read the response body for debugging
          const responseText = yield* Effect.tryPromise({
            try: () => fetchResponse.text(),
            catch: () => Effect.succeed(""),
          });

          yield* TradingLogger.logError(
            `Calendar API returned ${fetchResponse.status}: ${fetchResponse.statusText}`,
            new Error(`Response body: ${responseText.substring(0, 500)}`)
          );

          throw new MEXCApiError({
            message: `Calendar API returned ${fetchResponse.status}: ${fetchResponse.statusText}`,
            code: `EXTERNAL_API_ERROR_${fetchResponse.status}`,
            statusCode: fetchResponse.status,
            timestamp: new Date(),
          });
        }

        const responseText = yield* Effect.tryPromise({
          try: () => fetchResponse.text(),
          catch: (error) => {
            throw new MEXCApiError({
              message: `Failed to read calendar API response: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "INVALID_RESPONSE_FORMAT",
              statusCode: 0,
              timestamp: new Date(),
            });
          },
        });

        // Check if response is HTML (Cloudflare block page)
        if (
          responseText.trim().startsWith("<!DOCTYPE") ||
          responseText.trim().startsWith("<HTML")
        ) {
          yield* TradingLogger.logError(
            "Calendar API returned HTML instead of JSON (likely Cloudflare block)",
            new Error(`Response preview: ${responseText.substring(0, 200)}`)
          );
          throw new MEXCApiError({
            message:
              "Calendar API returned HTML (likely blocked by Cloudflare)",
            code: "CLOUDFLARE_BLOCK",
            statusCode: fetchResponse.status,
            timestamp: new Date(),
          });
        }

        let data: unknown;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          yield* TradingLogger.logError(
            "Failed to parse calendar API JSON",
            new Error(`Response: ${responseText.substring(0, 500)}`)
          );
          throw new MEXCApiError({
            message: `Failed to parse calendar API response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
            code: "INVALID_RESPONSE_FORMAT",
            statusCode: 0,
            timestamp: new Date(),
          });
        }

        // Handle MEXC's response structure: data.data.newCoins (double nested)
        let calendarData: CalendarEntry[] = [];

        // Primary structure: data.data.newCoins (matching working implementation)
        const newCoins = (
          (data as Record<string, unknown>)?.data as Record<string, unknown>
        )?.newCoins;
        if (Array.isArray(newCoins)) {
          calendarData = newCoins
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
            .map((entry: Record<string, unknown>): CalendarEntry => {
              const vcoinId = String(entry.vcoinId);
              const vcoinName = String(entry.vcoinName);
              const vcoinNameFull = String(
                entry.vcoinNameFull || entry.vcoinName || ""
              );
              const firstOpenTime = Number(entry.firstOpenTime || 0);
              const symbol = String(entry.symbol || `${vcoinName}USDT`);

              return {
                vcoinId,
                symbol,
                vcoinName,
                vcoinNameFull,
                firstOpenTime,
                zone: entry.zone ? String(entry.zone) : undefined,
              };
            })
            .filter((entry: CalendarEntry) => {
              // Validate firstOpenTime is a valid timestamp
              if (!entry.firstOpenTime || entry.firstOpenTime <= 0) {
                return false;
              }
              const date = new Date(entry.firstOpenTime);
              const isValidDate = !Number.isNaN(date.getTime());
              const isPositive = date.getTime() > 0;
              return isValidDate && isPositive;
            });
        } else {
          const fallbackData = (
            (data as Record<string, unknown>)?.data as Record<string, unknown>
          )?.data;
          if (Array.isArray(fallbackData)) {
            calendarData = fallbackData
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
              .map((entry: Record<string, unknown>): CalendarEntry => {
                const vcoinId = String(entry.vcoinId);
                const symbol = String(entry.symbol);
                const vcoinName = String(
                  entry.vcoinName || symbol.replace("USDT", "")
                );
                const vcoinNameFull = String(
                  entry.vcoinNameFull || entry.projectName || vcoinName
                );
                const firstOpenTime = Number(entry.firstOpenTime || 0);

                return {
                  vcoinId,
                  symbol,
                  vcoinName,
                  vcoinNameFull,
                  firstOpenTime,
                  zone: entry.zone ? String(entry.zone) : undefined,
                };
              })
              .filter((entry: CalendarEntry) => {
                if (!entry.firstOpenTime || entry.firstOpenTime <= 0) {
                  return false;
                }
                const date = new Date(entry.firstOpenTime);
                return !Number.isNaN(date.getTime()) && date.getTime() > 0;
              });
          }
        }

        yield* TradingLogger.logInfo(
          `Calendar API returned ${calendarData.length} valid listings`
        );

        return calendarData;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }).pipe(
      Effect.catchAll((error: unknown) => {
        // Log error but return empty array for graceful degradation
        return Effect.gen(function* () {
          const errorObj =
            error instanceof MEXCApiError ? error : new Error(String(error));
          yield* TradingLogger.logError(
            "Calendar API request failed, returning empty list",
            errorObj
          );
          return [] as CalendarEntry[];
        });
      })
    );
  };
}

// Export singleton instance
export const mexcClient = new MEXCApiClient();
