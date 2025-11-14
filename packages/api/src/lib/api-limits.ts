/**
 * MEXC API rate limit configuration
 */

/**
 * MEXC API rate limits
 */
export const MEXC_API_LIMITS = {
  /**
   * Requests per second across all endpoints
   */
  REQUESTS_PER_SECOND: 20,

  /**
   * Maximum concurrent requests
   */
  MAX_CONCURRENT: 10,

  /**
   * Minimum time between requests (ms)
   */
  MIN_TIME_MS: 50,

  /**
   * WebSocket subscriptions per connection
   */
  MAX_SUBSCRIPTIONS_PER_CONNECTION: 30,

  /**
   * Maximum total WebSocket connections per UID
   */
  MAX_CONNECTIONS_PER_UID: 300,
} as const;

/**
 * Rate limiter configuration based on MEXC limits
 */
export const RATE_LIMITER_CONFIG = {
  reservoir: MEXC_API_LIMITS.REQUESTS_PER_SECOND,
  reservoirRefreshAmount: MEXC_API_LIMITS.REQUESTS_PER_SECOND,
  reservoirRefreshInterval: 1000, // 1 second
  maxConcurrent: MEXC_API_LIMITS.MAX_CONCURRENT,
  minTime: MEXC_API_LIMITS.MIN_TIME_MS,
} as const;
