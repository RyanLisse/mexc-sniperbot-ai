import { Effect } from "effect";
import { MEXCApiError, withRetry, withLogging, defaultCircuitBreaker } from "../lib/effect";
import { getMEXCConfig } from "../lib/env";
import { createHmac } from "crypto";

// MEXC API types
export interface MEXCSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

export interface MEXCTicker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  timestamp: number;
}

export interface MEXCOrderResponse {
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
}

export interface MEXCAccountInfo {
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
}

// MEXC API Client class
export class MEXCApiClient {
  private readonly config = getMEXCConfig();
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
    this.secretKey = this.config.secretKey;
  }

  // Generate HMAC SHA256 signature for authenticated requests
  private generateSignature(queryString: string): string {
    return createHmac("sha256", this.secretKey)
      .update(queryString)
      .digest("hex");
  }

  // Make authenticated API request
  private makeAuthenticatedRequest = <T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Effect.Effect<T, MEXCApiError> => {
    return Effect.gen(function* () {
      const timestamp = Date.now().toString();
      const queryString = new URLSearchParams({
        ...params,
        timestamp,
        recvWindow: "5000",
      }).toString();

      const signature = this.generateSignature(queryString);
      const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "GET",
            headers: {
              "X-MEXC-APIKEY": this.apiKey,
              "Content-Type": "application/json",
            },
          }),
        catch: (error) => new MEXCApiError({
          message: `API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "API_REQUEST_FAILED",
          statusCode: 0,
          timestamp: new Date(),
        }),
      });

      if (!response.ok) {
        const errorText = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => "Unknown error",
        });

        throw new MEXCApiError({
          message: `API error: ${response.status} ${response.statusText} - ${errorText}`,
          code: `API_ERROR_${response.status}`,
          statusCode: response.status,
          timestamp: new Date(),
        });
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<T>,
        catch: (error) => new MEXCApiError({
          message: `JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "JSON_PARSE_ERROR",
          statusCode: response.status,
          timestamp: new Date(),
        }),
      });

      return data;
    }).pipe(
      withRetry,
      withLogging(`MEXC API: ${endpoint}`)
    );
  };

  // Make public API request (no authentication required)
  private makePublicRequest = <T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Effect.Effect<T, MEXCApiError> => {
    return Effect.gen(function* () {
      const queryString = new URLSearchParams(params).toString();
      const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }),
        catch: (error) => new MEXCApiError({
          message: `Public API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "PUBLIC_API_REQUEST_FAILED",
          statusCode: 0,
          timestamp: new Date(),
        }),
      });

      if (!response.ok) {
        const errorText = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => "Unknown error",
        });

        throw new MEXCApiError({
          message: `Public API error: ${response.status} ${response.statusText} - ${errorText}`,
          code: `PUBLIC_API_ERROR_${response.status}`,
          statusCode: response.status,
          timestamp: new Date(),
        });
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<T>,
        catch: (error) => new MEXCApiError({
          message: `JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "JSON_PARSE_ERROR",
          statusCode: response.status,
          timestamp: new Date(),
        }),
      });

      return data;
    }).pipe(
      withRetry,
      withLogging(`MEXC Public API: ${endpoint}`)
    );
  };

  // Get all available symbols
  getSymbols = (): Effect.Effect<MEXCSymbol[], MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makePublicRequest<MEXCSymbol[]>("/api/v3/exchangeInfo")
    );
  };

  // Get ticker information for a symbol
  getTicker = (symbol: string): Effect.Effect<MEXCTicker, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makePublicRequest<MEXCTicker[]>("/api/v3/ticker/price", { symbol })
    ).pipe(
      Effect.map(tickers => tickers[0]), // Return first ticker
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to get ticker for ${symbol}: ${error.message}`,
      }))
    );
  };

  // Get account information
  getAccountInfo = (): Effect.Effect<MEXCAccountInfo, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makeAuthenticatedRequest<MEXCAccountInfo>("/api/v3/account")
    );
  };

  // Place a market buy order
  placeMarketBuyOrder = (
    symbol: string,
    quantity: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makeAuthenticatedRequest<MEXCOrderResponse>("/api/v3/order", {
        symbol,
        side: "BUY",
        type: "MARKET",
        quantity,
      })
    ).pipe(
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to place market buy order for ${symbol}: ${error.message}`,
      }))
    );
  };

  // Place a limit buy order
  placeLimitBuyOrder = (
    symbol: string,
    quantity: string,
    price: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makeAuthenticatedRequest<MEXCOrderResponse>("/api/v3/order", {
        symbol,
        side: "BUY",
        type: "LIMIT",
        quantity,
        price,
        timeInForce: "GTC", // Good Till Cancelled
      })
    ).pipe(
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to place limit buy order for ${symbol}: ${error.message}`,
      }))
    );
  };

  // Check order status
  getOrderStatus = (
    symbol: string,
    orderId: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makeAuthenticatedRequest<MEXCOrderResponse>("/api/v3/order", {
        symbol,
        orderId,
      })
    ).pipe(
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to get order status for ${orderId}: ${error.message}`,
      }))
    );
  };

  // Cancel an order
  cancelOrder = (
    symbol: string,
    orderId: string
  ): Effect.Effect<MEXCOrderResponse, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makeAuthenticatedRequest<MEXCOrderResponse>("/api/v3/order", {
        symbol,
        orderId,
      })
    ).pipe(
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to cancel order ${orderId}: ${error.message}`,
      }))
    );
  };

  // Get recent trades for a symbol (useful for detecting new listings)
  getRecentTrades = (
    symbol: string,
    limit: number = 500
  ): Effect.Effect<Array<{
    id: string;
    price: string;
    qty: string;
    time: number;
    isBuyerMaker: boolean;
  }>, MEXCApiError> => {
    return defaultCircuitBreaker.execute(
      this.makePublicRequest<Array<{
        id: string;
        price: string;
        qty: string;
        time: number;
        isBuyerMaker: boolean;
      }>>("/api/v3/trades", { symbol, limit: limit.toString() })
    ).pipe(
      Effect.mapError(error => new MEXCApiError({
        ...error,
        message: `Failed to get recent trades for ${symbol}: ${error.message}`,
      }))
    );
  };

  // Get server time (useful for timestamp synchronization)
  getServerTime = (): Effect.Effect<{ serverTime: number }, MEXCApiError> => {
    return this.makePublicRequest<{ serverTime: number }>("/api/v3/time");
  };
}

// Export singleton instance
export const mexcClient = new MEXCApiClient();
