import { Counter, Gauge, Histogram, register } from "prom-client";

/**
 * Prometheus metrics registry
 */
const metricsRegistry = register;

/**
 * Order execution latency histogram
 * Tracks P50, P95, P99 latencies
 */
export const orderLatency = new Histogram({
  name: "order_execution_latency_ms",
  help: "Order execution latency in milliseconds",
  buckets: [10, 25, 50, 100, 250, 500, 1000],
  labelNames: ["symbol", "order_type"],
});

/**
 * Total trades counter
 */
export const tradesTotal = new Counter({
  name: "trades_total",
  help: "Total number of trades executed",
  labelNames: ["symbol", "side", "status"],
});

/**
 * Portfolio value gauge
 */
export const portfolioValue = new Gauge({
  name: "portfolio_value_usd",
  help: "Current portfolio value in USD",
});

/**
 * API error rate counter
 */
export const apiErrors = new Counter({
  name: "api_errors_total",
  help: "Total number of API errors",
  labelNames: ["endpoint", "status_code"],
});

/**
 * WebSocket connection status gauge
 */
export const websocketConnections = new Gauge({
  name: "websocket_connections",
  help: "Number of active WebSocket connections",
});

/**
 * Circuit breaker state gauge
 */
export const circuitBreakerState = new Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
  labelNames: ["breaker_name"],
});

/**
 * Rate limiter queue depth gauge
 */
export const rateLimiterQueueDepth = new Gauge({
  name: "rate_limiter_queue_depth",
  help: "Number of requests waiting in rate limiter queue",
  labelNames: ["limiter_name"],
});

/**
 * Cache hit rate counter
 */
export const cacheHits = new Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_type"],
});

export const cacheMisses = new Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_type"],
});

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Instrument order execution with metrics
 */
export function instrumentOrderExecution<T>(
  symbol: string,
  orderType: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  return operation()
    .then((result) => {
      const latency = Date.now() - start;
      orderLatency.observe({ symbol, order_type: orderType }, latency);
      tradesTotal.inc({ symbol, side: "buy", status: "success" });
      return result;
    })
    .catch((error) => {
      const latency = Date.now() - start;
      orderLatency.observe({ symbol, order_type: orderType }, latency);
      tradesTotal.inc({ symbol, side: "buy", status: "failed" });
      throw error;
    });
}
