import { Effect } from "effect";
import CircuitBreaker from "opossum";
import { MEXCApiError, TradingError } from "./effect";

/**
 * Circuit breaker options for Opossum
 */
const circuitBreakerOptions = {
  timeout: 3000, // Timeout after 3s
  errorThresholdPercentage: 50, // Open circuit at 50% errors
  resetTimeout: 30_000, // Try again after 30s
  rollingCountTimeout: 60_000, // Rolling window of 60s
  rollingCountBuckets: 10, // 10 buckets for rolling window
  name: "MEXC-API",
  enabled: true,
};

/**
 * Create a circuit breaker for an Effect operation
 */
export function createCircuitBreakerForEffect<A, E>(
  operation: () => Effect.Effect<A, E>,
  options = circuitBreakerOptions
): Effect.Effect<A, E | TradingError> {
  const breaker = new CircuitBreaker(
    async () => Effect.runPromise(operation()),
    options
  );

  return Effect.tryPromise({
    try: () => breaker.fire(),
    catch: (error) => {
      if (breaker.opened) {
        return new TradingError({
          message: "Circuit breaker is OPEN - exchange unavailable",
          code: "CIRCUIT_BREAKER_OPEN",
          timestamp: new Date(),
        });
      }
      if (error instanceof TradingError || error instanceof MEXCApiError) {
        return error as E;
      }
      return new TradingError({
        message: `Circuit breaker error: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "CIRCUIT_BREAKER_ERROR",
        timestamp: new Date(),
      });
    },
  });
}

/**
 * Circuit breaker for MEXC API calls
 */
export const mexcApiCircuitBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => fn(),
  {
    ...circuitBreakerOptions,
    name: "MEXC-API",
  }
);

// Event handlers for monitoring
mexcApiCircuitBreaker.on("open", () => {
  console.error("[Circuit Breaker] MEXC API circuit opened");
});

mexcApiCircuitBreaker.on("halfOpen", () => {
  console.log("[Circuit Breaker] MEXC API circuit half-open");
});

mexcApiCircuitBreaker.on("close", () => {
  console.log("[Circuit Breaker] MEXC API circuit closed");
});
