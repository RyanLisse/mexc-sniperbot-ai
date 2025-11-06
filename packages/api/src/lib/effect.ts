import { Effect, Layer, Context, pipe, Schema } from "effect";
import { z } from "zod";

// Error types for the trading system
export class TradingError extends Schema.TaggedError("TradingError")<{
  message: string;
  code: string;
  timestamp: Date;
}> {}

export class MEXCApiError extends Schema.TaggedError("MEXCApiError")<{
  message: string;
  code: string;
  statusCode: number;
  timestamp: Date;
}> {}

export class DatabaseError extends Schema.TaggedError("DatabaseError")<{
  message: string;
  query: string;
  timestamp: Date;
}> {}

export class ConfigurationError extends Schema.TaggedError("ConfigurationError")<{
  message: string;
  field: string;
  timestamp: Date;
}> {}

// Service interfaces for dependency injection
export class MEXCApiClient extends Context.Tag("MEXCApiClient")<
  MEXCApiClient,
  {
    readonly getSymbols: Effect.Effect<string[], MEXCApiError>;
    readonly placeOrder: (params: OrderParams) => Effect.Effect<OrderResult, MEXCApiError>;
    readonly getAccountInfo: Effect.Effect<AccountInfo, MEXCApiError>;
  }
>() {}

export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly saveTradeAttempt: (trade: TradeAttempt) => Effect.Effect<void, DatabaseError>;
    readonly getTradeHistory: (limit: number) => Effect.Effect<TradeAttempt[], DatabaseError>;
    readonly updateBotStatus: (status: BotStatus) => Effect.Effect<void, DatabaseError>;
  }
>() {}

export class Logger extends Context.Tag("Logger")<
  Logger,
  {
    readonly info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
    readonly error: (message: string, error?: Error) => Effect.Effect<void, never>;
    readonly warn: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
  }
>() {}

// Type definitions
export interface OrderParams {
  symbol: string;
  side: "BUY";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  status: string;
  executedQuantity?: string;
  executedPrice?: string;
}

export interface AccountInfo {
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface TradeAttempt {
  id: string;
  symbol: string;
  status: string;
  quantity: string;
  price?: string;
  createdAt: Date;
}

export interface BotStatus {
  isRunning: boolean;
  lastHeartbeat: Date;
  mexcApiStatus: string;
  apiResponseTime: number;
}

// Retry configuration for API calls
export const retryPolicy = {
  times: 3,
  delay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000),
};

// Timeout configuration
export const timeoutConfig = {
  apiCall: 5000, // 5 seconds
  databaseQuery: 1000, // 1 second
  tradeExecution: 10000, // 10 seconds
};

// Helper functions
export const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  policy = retryPolicy
) => pipe(
  effect,
  Effect.retry(policy),
  Effect.timeout(timeoutConfig.apiCall)
);

export const withLogging = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operation: string
) => pipe(
  effect,
  Effect.tapError((error) => 
    Logger.pipe(
      Effect.flatMap(logger => logger.error(`Operation failed: ${operation}`, error))
    )
  ),
  Effect.tap((result) =>
    Logger.pipe(
      Effect.flatMap(logger => logger.info(`Operation completed: ${operation}`, { result }))
    )
  )
);

// Circuit breaker pattern for API resilience
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  
  constructor(
    private readonly threshold = 5,
    private readonly timeout = 60000 // 1 minute
  ) {}
  
  execute<A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | TradingError, R> {
    return pipe(
      Effect.sync(() => this.checkState()),
      Effect.flatMap(() => effect),
      Effect.tapError(() => Effect.sync(() => this.recordFailure())),
      Effect.tap(() => Effect.sync(() => this.recordSuccess()))
    );
  }
  
  private checkState(): void {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new TradingError({
          message: "Circuit breaker is OPEN",
          code: "CIRCUIT_BREAKER_OPEN",
          timestamp: new Date(),
        });
      }
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }
  
  private recordSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }
}

// Default circuit breaker instance
export const defaultCircuitBreaker = new CircuitBreaker();
