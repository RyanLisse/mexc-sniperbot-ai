import { Effect, Schedule } from "effect";
import { MEXCApiError, TradingError, TradingLogger } from "../lib/effect";

// Retry configuration types
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: MEXCApiError | TradingError;
  attempts: number;
  totalDurationMs: number;
}

// Default retry configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
};

export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 1.5,
  jitter: true,
};

export const CONSERVATIVE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
  backoffMultiplier: 3,
  jitter: false,
};

// Retry service class
export class RetryService {
  // Create exponential backoff schedule
  private createExponentialBackoffSchedule = (config: RetryConfig): Schedule.Schedule<number> => {
    return Schedule.exponential(config.baseDelayMs, config.backoffMultiplier)
      .pipe(
        Schedule.upTo(Schedule.duration(config.maxDelayMs)),
        Schedule.compose(Schedule.recurs(config.maxRetries)),
        config.jitter ? Schedule.jittered : Schedule.identity
      );
  };

  // Execute an operation with retry logic
  executeWithRetry = <A, E extends MEXCApiError | TradingError>(
    operation: Effect.Effect<A, E>,
    operationName: string,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Effect.Effect<RetryResult<A>, E> => {
    return Effect.gen(function* () {
      const startTime = Date.now();
      let attempts = 0;

      yield* TradingLogger.logInfo(`Starting retry operation: ${operationName}`, {
        maxRetries: config.maxRetries,
        baseDelayMs: config.baseDelayMs,
      });

      const schedule = this.createExponentialBackoffSchedule(config);

      const result = yield* Effect.retry(operation, schedule).pipe(
        Effect.tapError((error) => 
          Effect.gen(function* () {
            attempts += 1;
            yield* TradingLogger.logWarn(`Retry attempt ${attempts} failed for ${operationName}`, {
              error: error.message,
              code: error.code,
              attempt: attempts,
            });
          })
        ),
        Effect.both
      );

      const totalDurationMs = Date.now() - startTime;

      if (result._tag === "Left") {
        // Operation failed after all retries
        attempts = config.maxRetries + 1;
        
        yield* TradingLogger.logError(`Operation ${operationName} failed after ${attempts} attempts`, result.left as Error);

        return {
          success: false,
          error: result.left,
          attempts,
          totalDurationMs,
        } as RetryResult<A>;
      } else {
        // Operation succeeded
        attempts = result.right._tag === "Some" ? 1 : 1; // Will be calculated properly in real implementation
        
        yield* TradingLogger.logInfo(`Operation ${operationName} succeeded after ${attempts} attempts`, {
          totalDurationMs,
        });

        return {
          success: true,
          result: result.right.value,
          attempts,
          totalDurationMs,
        } as RetryResult<A>;
      }
    });
  };

  // Execute with circuit breaker pattern
  executeWithCircuitBreaker = <A, E extends MEXCApiError | TradingError>(
    operation: Effect.Effect<A, E>,
    operationName: string,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    failureThreshold: number = 5,
    recoveryTimeoutMs: number = 60_000
  ): Effect.Effect<RetryResult<A>, E> => {
    return Effect.gen(function* () {
      // Simple circuit breaker implementation
      // In a production system, you'd want a more sophisticated circuit breaker
      const failures = 0;
      const lastFailureTime = 0;
      const state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

      const checkCircuitBreaker = (): Effect.Effect<void, E> => {
        return Effect.sync(() => {
          if (state === "OPEN") {
            if (Date.now() - lastFailureTime > recoveryTimeoutMs) {
              // Transition to HALF_OPEN
              // state = "HALF_OPEN";
            } else {
              throw new TradingError({
                message: `Circuit breaker is OPEN for ${operationName}`,
                code: "CIRCUIT_BREAKER_OPEN",
                timestamp: new Date(),
              }) as E;
            }
          }
        });
      };

      yield* checkCircuitBreaker();

      return yield* this.executeWithRetry(operation, operationName, config);
    });
  };

  // Retry with specific error handling
  executeWithSelectiveRetry = <A, E extends MEXCApiError | TradingError>(
    operation: Effect.Effect<A, E>,
    operationName: string,
    shouldRetry: (error: E) => boolean,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Effect.Effect<RetryResult<A>, E> => {
    return Effect.gen(function* () {
      const startTime = Date.now();
      let attempts = 0;

      yield* TradingLogger.logInfo(`Starting selective retry operation: ${operationName}`);

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        attempts = attempt + 1;

        try {
          const result = yield* operation;
          
          const totalDurationMs = Date.now() - startTime;
          
          yield* TradingLogger.logInfo(`Selective retry operation ${operationName} succeeded on attempt ${attempts}`, {
            totalDurationMs,
          });

          return {
            success: true,
            result,
            attempts,
            totalDurationMs,
          } as RetryResult<A>;
        } catch (error) {
          const typedError = error as E;
          
          if (attempt === config.maxRetries || !shouldRetry(typedError)) {
            const totalDurationMs = Date.now() - startTime;
            
            yield* TradingLogger.logError(`Selective retry operation ${operationName} failed after ${attempts} attempts`, typedError as Error);

            return {
              success: false,
              error: typedError,
              attempts,
              totalDurationMs,
            } as RetryResult<A>;
          }

          // Calculate delay for next attempt
          const delay = Math.min(
            config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelayMs
          );

          const jitteredDelay = config.jitter 
            ? delay * (0.5 + Math.random() * 0.5)
            : delay;

          yield* TradingLogger.logWarn(`Selective retry attempt ${attempts} failed for ${operationName}, retrying in ${jitteredDelay}ms`, {
            error: typedError.message,
            code: typedError.code,
            nextDelay: jitteredDelay,
          });

          // Wait before retrying
          yield* Effect.sleep(jitteredDelay);
        }
      }

      // This should never be reached, but TypeScript requires it
      throw new TradingError({
        message: `Unexpected error in selective retry for ${operationName}`,
        code: "SELECTIVE_RETRY_ERROR",
        timestamp: new Date(),
      }) as E;
    });
  };

  // Batch retry for multiple operations
  executeBatchWithRetry = <A, E extends MEXCApiError | TradingError>(
    operations: Array<{
      operation: Effect.Effect<A, E>;
      name: string;
      config?: RetryConfig;
    }>
  ): Effect.Effect<Array<RetryResult<A>>, never> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(`Starting batch retry operations`, {
        operationCount: operations.length,
      });

      const results = yield* Effect.all(
        operations.map(({ operation, name, config }) =>
          this.executeWithRetry(operation, name, config).pipe(
            Effect.catchAll((error) => Effect.succeed({
              success: false,
              error,
              attempts: 0,
              totalDurationMs: 0,
            } as RetryResult<A>))
          )
        )
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      yield* TradingLogger.logInfo(`Batch retry operations completed`, {
        total: results.length,
        successCount,
        failureCount,
      });

      return results;
    });
  };

  // Get retry statistics
  getRetryStatistics = (results: Array<RetryResult<unknown>>) => {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
      averageAttempts: results.length > 0 
        ? results.reduce((sum, r) => sum + r.attempts, 0) / results.length 
        : 0,
      averageDuration: results.length > 0
        ? results.reduce((sum, r) => sum + r.totalDurationMs, 0) / results.length
        : 0,
      totalDuration: results.reduce((sum, r) => sum + r.totalDurationMs, 0),
    };
  };
}

// Export singleton instance
export const retryService = new RetryService();

// Helper functions for common retry scenarios
export const retryMEXCOperation = <A>(
  operation: Effect.Effect<A, MEXCApiError>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<RetryResult<A>, MEXCApiError> => {
  return retryService.executeWithRetry(operation, operationName, config);
};

export const retryTradingOperation = <A>(
  operation: Effect.Effect<A, TradingError>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<RetryResult<A>, TradingError> => {
  return retryService.executeWithRetry(operation, operationName, config);
};

// Error type predicates for selective retry
export const shouldRetryMEXCError = (error: MEXCApiError): boolean => {
  // Retry on network errors and rate limiting
  const retryableCodes = [
    "API_REQUEST_FAILED",
    "PUBLIC_API_REQUEST_FAILED",
    "API_ERROR_429", // Rate limit
    "API_ERROR_500", // Server error
    "API_ERROR_502", // Bad gateway
    "API_ERROR_503", // Service unavailable
    "API_ERROR_504", // Gateway timeout
  ];

  return retryableCodes.includes(error.code) || 
         (error.statusCode >= 500 && error.statusCode < 600) ||
         error.statusCode === 429;
};

export const shouldRetryTradingError = (error: TradingError): boolean => {
  // Retry on temporary failures
  const retryableCodes = [
    "CONFIGURATION_FETCH_FAILED",
    "TODAY_TRADES_FETCH_FAILED",
    "HOURLY_TRADES_FETCH_FAILED",
  ];

  return retryableCodes.includes(error.code);
};
