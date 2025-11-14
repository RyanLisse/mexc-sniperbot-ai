import Bottleneck from "bottleneck";
import { Effect } from "effect";
import { RATE_LIMITER_CONFIG } from "../lib/api-limits";
import { MEXCApiError } from "../lib/effect";

/**
 * Rate limiter configuration for MEXC API
 * MEXC allows approximately 20 requests per second
 */
const rateLimiterConfig = RATE_LIMITER_CONFIG;

/**
 * Rate limiter for MEXC API calls
 */
export const mexcRateLimiter = new Bottleneck(rateLimiterConfig);

// Monitor limiter status
mexcRateLimiter.on("failed", async (_error, jobInfo) => {
  if (jobInfo.retryCount < 3) {
    return 5000; // Retry after 5s
  }
});

mexcRateLimiter.on("depleted", () => {
  console.warn("[Rate Limiter] MEXC API rate limit depleted");
});

mexcRateLimiter.on("error", (error) => {
  console.error("[Rate Limiter] Error:", error);
});

/**
 * Wrap an Effect operation with rate limiting
 */
export function withRateLimit<A, E>(
  effect: Effect.Effect<A, E>,
  limiter: Bottleneck = mexcRateLimiter
): Effect.Effect<A, E | MEXCApiError> {
  return Effect.tryPromise({
    try: () => limiter.wrap(() => Effect.runPromise(effect))(),
    catch: (error) =>
      new MEXCApiError({
        message: `Rate limit error: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "RATE_LIMIT_ERROR",
        statusCode: 429,
        timestamp: new Date(),
      }),
  });
}

/**
 * Get rate limiter metrics
 */
export function getRateLimiterMetrics(limiter: Bottleneck = mexcRateLimiter) {
  return {
    running: limiter.running(),
    done: limiter.done(),
    queued: limiter.queued(),
    counts: limiter.counts(),
  };
}
