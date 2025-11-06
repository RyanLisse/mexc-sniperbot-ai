import { Context, Effect, pipe, Schema, Schedule } from "effect";

// Error types for the trading system
export class TradingError extends Schema.TaggedError<TradingError>()("TradingError", {
  message: Schema.String,
  code: Schema.String,
  timestamp: Schema.DateFromSelf,
}) {}

export class MEXCApiError extends Schema.TaggedError<MEXCApiError>()("MEXCApiError", {
  message: Schema.String,
  code: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  timestamp: Schema.DateFromSelf,
}) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
  code: Schema.String,
  timestamp: Schema.DateFromSelf,
}) {}

export class ConfigurationError extends Schema.TaggedError<ConfigurationError>()("ConfigurationError", {
  message: Schema.String,
  field: Schema.optional(Schema.String),
  timestamp: Schema.DateFromSelf,
}) {}

// Service interfaces for dependency injection
export class MEXCApiClient extends Context.Tag("MEXCApiClient")<
  MEXCApiClient,
  {
    readonly getSymbols: Effect.Effect<string[], MEXCApiError>;
    readonly placeOrder: (
      params: OrderParams
    ) => Effect.Effect<OrderResult, MEXCApiError>;
    readonly getAccountInfo: Effect.Effect<AccountInfo, MEXCApiError>;
  }
>() {}

export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly saveTradeAttempt: (
      trade: TradeAttempt
    ) => Effect.Effect<void, DatabaseError>;
    readonly getTradeHistory: (
      limit: number
    ) => Effect.Effect<TradeAttempt[], DatabaseError>;
    readonly updateBotStatus: (
      status: BotStatus
    ) => Effect.Effect<void, DatabaseError>;
  }
>() {}

export class Logger extends Context.Tag("Logger")<
  Logger,
  {
    readonly info: (
      message: string,
      meta?: Record<string, unknown>
    ) => Effect.Effect<void, never>;
    readonly error: (
      message: string,
      error?: Error
    ) => Effect.Effect<void, never>;
    readonly warn: (
      message: string,
      meta?: Record<string, unknown>
    ) => Effect.Effect<void, never>;
  }
>() {}

// Type definitions
export type OrderParams = {
  symbol: string;
  side: "BUY";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
};

export type OrderResult = {
  orderId: string;
  symbol: string;
  status: string;
  executedQuantity?: string;
  executedPrice?: string;
};

export type AccountInfo = {
  balances: {
    asset: string;
    free: string;
    locked: string;
  }[];
};

export type TradeAttempt = {
  id: string;
  symbol: string;
  status: string;
  quantity: string;
  price?: string;
  createdAt: Date;
};

export type BotStatus = {
  isRunning: boolean;
  lastHeartbeat: Date;
  mexcApiStatus: string;
  apiResponseTime: number;
};

// Retry configuration for API calls
export const retryPolicy = {
  times: 3,
  delay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
};

// Timeout configuration
export const timeoutConfig = {
  apiCall: 5000, // 5 seconds
  databaseQuery: 1000, // 1 second
  tradeExecution: 10_000, // 10 seconds
};

// Helper functions
export const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  policy = retryPolicy
): Effect.Effect<A, E | Effect.TimeoutException, R> => pipe(
  effect,
  Effect.retry(Schedule.exponential(1_000)),
  Effect.timeout(timeoutConfig.apiCall)
);

export const withLogging = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operation: string
): Effect.Effect<A, E, R> => pipe(
  effect,
  Effect.tapError((error) =>
    Effect.logError(`Operation failed: ${operation}`, error)
  ),
  Effect.tap((result) =>
    Effect.logInfo(`Operation completed: ${operation}`, { result })
  )
);

// Circuit breaker pattern for API resilience
export class CircuitBreaker {
  private failuresCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;

  constructor(failureThreshold = 5, recoveryTimeout = 60_000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
  }

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
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
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
    this.failuresCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failuresCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  private recordSuccess(): void {
    this.failuresCount = 0;
    this.state = "CLOSED";
  }
}

// Default circuit breaker instance
export const defaultCircuitBreaker = new CircuitBreaker();
