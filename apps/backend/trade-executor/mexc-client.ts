import crypto from "crypto";
import log from "encore.dev/log";
import { secret } from "encore.dev/config";

/**
 * MEXC API credentials from Encore secrets
 */
const MEXCApiKey = secret("MEXCApiKey");
const MEXCSecretKey = secret("MEXCSecretKey");

/**
 * MEXC API Base URL
 */
const MEXC_API_BASE = "https://api.mexc.com";
const MAX_ORDER_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;

/**
 * MEXC order side
 */
export type MEXCOrderSide = "BUY" | "SELL";

/**
 * MEXC order type
 */
export type MEXCOrderType = "MARKET" | "LIMIT";

/**
 * Market buy order request using quoteOrderQty (USDT amount)
 * Aligns with User Story 2 FR-006
 */
export interface MarketBuyOrderRequest {
  symbol: string;
  quoteOrderQty: number; // USDT amount
}

/**
 * MEXC order response
 */
export interface MEXCOrderResponse {
  orderId: string;
  symbol: string;
  status: string;
  executedQty: string; // Base currency amount filled
  cummulativeQuoteQty: string; // Quote currency amount spent
  price: string; // Average fill price
}

/**
 * Generate HMAC-SHA256 signature for MEXC API authentication
 * T092: HMAC signature generation
 */
function generateSignature(queryString: string, secretKey: string): string {
  return crypto.createHmac("sha256", secretKey).update(queryString).digest("hex");
}

/**
 * Build query string from parameters and add signature
 * T092: Signature utility
 */
function buildSignedQuery(params: Record<string, string | number>, secretKey: string): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, string | number>);

  // Build query string
  const queryString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  // Generate signature
  const signature = generateSignature(queryString, secretKey);

  return `${queryString}&signature=${signature}`;
}

/**
 * Get server time from MEXC to avoid clock skew issues
 * T093: Timestamp synchronization
 */
async function getServerTime(): Promise<number> {
  try {
    const response = await fetch(`${MEXC_API_BASE}/api/v3/time`);
    if (!response.ok) {
      throw new Error(`Failed to get server time: ${response.statusText}`);
    }
    const data = (await response.json()) as { serverTime: number };
    return data.serverTime;
  } catch (error) {
    log.warn("Failed to get MEXC server time, using local time", { error });
    return Date.now();
  }
}

async function sendOrderWithRetry(
  url: string,
  options: RequestInit,
  symbol: string,
  quoteOrderQty: number
): Promise<Response> {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fetch(url, options);
    } catch (error) {
      attempt += 1;

      if (attempt >= MAX_ORDER_RETRIES) {
        log.error("MEXC order request failed after retries", {
          metric: "mexc_order_failed",
          symbol,
          quoteOrderQty,
          attempt,
          error,
        });
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);

      log.warn("MEXC order request failed, retrying", {
        metric: "mexc_order_retry",
        symbol,
        quoteOrderQty,
        attempt,
        delayMs: delay,
        error,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Place a market buy order on MEXC using quoteOrderQty
 * T094: Market buy order with quoteOrderQty
 * T095: Order status polling
 * T096: Retry logic with exponential backoff
 * T097: Integration with executor
 */
export async function placeMarketBuyOrder(
  request: MarketBuyOrderRequest
): Promise<MEXCOrderResponse> {
  const startTime = performance.now();

  try {
    // T093: Get server time for signature
    const timestamp = await getServerTime();

    // Build request parameters
    const params = {
      symbol: request.symbol,
      side: "BUY" as MEXCOrderSide,
      type: "MARKET" as MEXCOrderType,
      quoteOrderQty: request.quoteOrderQty.toFixed(2),
      timestamp,
      recvWindow: 5000, // 5 second window
    };

    // T092: Generate signed query
    const queryString = buildSignedQuery(params, MEXCSecretKey());

    // T098: Structured logging for API call
    log.info("Placing MEXC market buy order", {
      metric: "mexc_api_call",
      symbol: request.symbol,
      quoteOrderQty: request.quoteOrderQty,
    });

    // Make API request with retry for transient failures
    const response = await sendOrderWithRetry(`${MEXC_API_BASE}/api/v3/order?${queryString}`, {
      method: "POST",
      headers: {
        "X-MEXC-APIKEY": MEXCApiKey(),
        "Content-Type": "application/json",
      },
    }, request.symbol, request.quoteOrderQty);

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorBody = await response.text();
      
      // T099: Handle MEXC error codes
      log.error("MEXC order failed", {
        metric: "mexc_order_error",
        symbol: request.symbol,
        status: response.status,
        error: errorBody,
        latencyMs,
      });

      throw new Error(`MEXC API error (${response.status}): ${errorBody}`);
    }

    const orderResponse = (await response.json()) as MEXCOrderResponse;

    // T101: Log execution latency
    log.info("MEXC order placed successfully", {
      metric: "mexc_order_success",
      orderId: orderResponse.orderId,
      symbol: orderResponse.symbol,
      executedQty: orderResponse.executedQty,
      latencyMs,
    });

    return orderResponse;
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    
    log.error("Failed to place MEXC order", {
      metric: "mexc_order_failed",
      symbol: request.symbol,
      error,
      latencyMs,
    });

    throw error;
  }
}

/**
 * Validate MEXC API credentials on startup
 * T103: Secret validation
 */
export async function validateMEXCCredentials(): Promise<boolean> {
  try {
    const apiKey = MEXCApiKey();
    const secretKey = MEXCSecretKey();

    if (!apiKey || !secretKey) {
      log.error("MEXC API credentials not configured - trading disabled");
      return false;
    }

    // Test API connectivity with account endpoint
    const timestamp = await getServerTime();
    const queryString = buildSignedQuery({ timestamp }, secretKey);

    const response = await fetch(`${MEXC_API_BASE}/api/v3/account?${queryString}`, {
      method: "GET",
      headers: {
        "X-MEXC-APIKEY": apiKey,
      },
    });

    if (!response.ok) {
      log.error("MEXC API credentials invalid or insufficient permissions", {
        status: response.status,
      });
      return false;
    }

    log.info("MEXC API credentials validated successfully");
    return true;
  } catch (error) {
    log.error("Failed to validate MEXC credentials", { error });
    return false;
  }
}

let cachedCredentialValidation: Promise<boolean> | null = null;

export async function ensureMEXCCredentialsValid(): Promise<void> {
  if (!cachedCredentialValidation) {
    cachedCredentialValidation = validateMEXCCredentials();
  }

  const isValid = await cachedCredentialValidation;

  if (!isValid) {
    throw new Error("MEXC API credentials are not configured or invalid; live trading is disabled");
  }
}
