import { drizzle } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { Pool, type PoolConfig } from "pg";
import { botStatus } from "../schema/bot-status";
import { tradingConfiguration } from "../schema/configuration";
import { listingEvent } from "../schema/listing-events";
import { tradeAttempt } from "../schema/trade-attempts";
import { userSession } from "../schema/user-sessions";
import { getDatabaseConfig } from "./env";

// Connection pool configuration
const createPoolConfig = (): PoolConfig => {
  const config = getDatabaseConfig();

  return {
    connectionString: config.url,
    max: 20, // Maximum number of connections in pool
    min: 5, // Minimum number of connections to maintain
    idleTimeoutMillis: 30_000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: config.queryTimeout,
    statement_timeout: config.queryTimeout,
    query_timeout: config.queryTimeout,
    // Enable SSL for production
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    // Performance optimizations
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
};

// Create connection pool
let pool: Pool | null = null;

export function getConnectionPool(): Pool {
  if (!pool) {
    pool = new Pool(createPoolConfig());

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });

    // Log pool events in development
    if (process.env.NODE_ENV === "development") {
      pool.on("connect", (_client) => {
        console.debug("New client connected to pool");
      });

      pool.on("remove", (_client) => {
        console.debug("Client removed from pool");
      });
    }
  }

  return pool;
}

// Create drizzle instance with pooled connection
export const createPooledDb = () => {
  const connectionPool = getConnectionPool();
  return drizzle(connectionPool, {
    schema: {
      tradingConfiguration,
      listingEvent,
      tradeAttempt,
      botStatus,
      userSession,
    },
  });
};

// Health check for database connection
export const checkDatabaseHealth = Effect.try({
  try: async () => {
    const healthPool = getConnectionPool();
    const client = await healthPool.connect();

    try {
      const _result = await client.query("SELECT 1 as health_check");
      return {
        status: "pass" as const,
        responseTime: Date.now(),
        connectedClients: healthPool.totalCount,
        idleClients: healthPool.idleCount,
        waitingClients: healthPool.waitingCount,
      };
    } finally {
      client.release();
    }
  },
  catch: (error) => {
    throw new Error(
      `Database health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  },
});

// Connection pool metrics
export const getPoolMetrics = Effect.sync(() => {
  const metricsPool = getConnectionPool();

  return {
    totalCount: metricsPool.totalCount,
    idleCount: metricsPool.idleCount,
    waitingCount: metricsPool.waitingCount,
    maxCount: metricsPool.options.max || 20,
    minCount: metricsPool.options.min || 5,
  };
});

// Graceful shutdown
export const closeConnectionPool = Effect.try({
  try: async () => {
    if (pool) {
      await pool.end();
      pool = null;
      console.log("Database connection pool closed");
    }
  },
  catch: (error) => {
    console.error("Error closing database connection pool:", error);
    throw error;
  },
});

// Performance monitoring wrapper
export const withConnectionMetrics = <T>(
  operation: () => Promise<T>,
  operationName: string
) =>
  Effect.gen(function* () {
    const startTime = Date.now();

    try {
      const result = yield* Effect.tryPromise({
        try: () => operation(),
        catch: (error) =>
          new Error(
            `${operationName} failed: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
      });

      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > 1000) {
        console.warn(
          `Slow query detected: ${operationName} took ${duration}ms`
        );
      }

      return {
        result,
        metrics: {
          operation: operationName,
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `Query failed: ${operationName} after ${duration}ms`,
        error
      );
      throw error;
    }
  });

// Transaction helper with timeout
export const withTransaction = <T>(
  callback: (client: import("pg").PoolClient) => Promise<T>,
  timeoutMs = 5000
) =>
  Effect.gen(function* () {
    const transactionPool = getConnectionPool();
    const transactionClient = yield* Effect.tryPromise({
      try: () => transactionPool.connect(),
      catch: (error) =>
        new Error(
          `Failed to get database connection: ${error instanceof Error ? error.message : "Unknown error"}`
        ),
    });

    try {
      yield* Effect.tryPromise({
        try: () => transactionClient.query("BEGIN"),
        catch: (error) =>
          new Error(
            `Failed to begin transaction: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
      });

      const result = yield* Effect.tryPromise({
        try: () => callback(transactionClient),
        catch: (error) =>
          new Error(
            `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
      });

      yield* Effect.tryPromise({
        try: () => transactionClient.query("COMMIT"),
        catch: (error) =>
          new Error(
            `Failed to commit transaction: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
      });

      return result;
    } catch (error) {
      yield* Effect.tryPromise({
        try: () => transactionClient.query("ROLLBACK"),
        catch: (rollbackError) => {
          console.error("Failed to rollback transaction:", rollbackError);
        },
      });
      throw error;
    } finally {
      transactionClient.release();
    }
  }).pipe(Effect.timeout(timeoutMs));

// Batch query helper for performance
export const batchQuery = <T>(queries: Array<() => Promise<T>>) =>
  Effect.gen(function* () {
    const batchPool = getConnectionPool();
    const batchClient = yield* Effect.tryPromise({
      try: () => batchPool.connect(),
      catch: (error) =>
        new Error(
          `Failed to get database connection for batch query: ${error instanceof Error ? error.message : "Unknown error"}`
        ),
    });

    try {
      const results = yield* Effect.all(
        queries.map((query) =>
          Effect.tryPromise({
            try: query,
            catch: (error) =>
              new Error(
                `Batch query item failed: ${error instanceof Error ? error.message : "Unknown error"}`
              ),
          })
        )
      );

      return results;
    } finally {
      batchClient.release();
    }
  });

// Export the pooled database instance
export const db = createPooledDb();
