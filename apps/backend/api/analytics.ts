import { api } from "encore.dev/api";
import { BotDB } from "../db/db";


export interface PerformanceMetrics {
  avgExecutionLatency: number;
  p95ExecutionLatency: number;
  p99ExecutionLatency: number;
  successRate: number;
  tradesPerHour: number;
  listingsPerHour: number;
}

export const getPerformanceMetrics = api<void, PerformanceMetrics>(
  { method: "GET", path: "/analytics/performance", expose: true },
  async () => {
    const latencyStats = await BotDB.queryRow<{
      avg: number;
      p95: number;
      p99: number;
    }>`
      SELECT 
        AVG(latency_ms)::int as avg,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::int as p99
      FROM trades
      WHERE status = 'executed' AND created_at > NOW() - INTERVAL '24 hours'
    `;

    const tradeStats = await BotDB.queryRow<{
      total: number;
      executed: number;
    }>`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'executed' THEN 1 END)::int as executed
      FROM trades
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const tradesPerHour = await BotDB.queryRow<{ rate: number }>`
      SELECT 
        COUNT(*)::int / GREATEST(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600, 1) as rate
      FROM trades
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const listingsPerHour = await BotDB.queryRow<{ rate: number }>`
      SELECT 
        COUNT(*)::int / GREATEST(EXTRACT(EPOCH FROM (MAX(detected_at) - MIN(detected_at))) / 3600, 1) as rate
      FROM listings
      WHERE detected_at > NOW() - INTERVAL '24 hours'
    `;

    const successRate =
      tradeStats && tradeStats.total > 0
        ? (tradeStats.executed / tradeStats.total) * 100
        : 0;

    return {
      avgExecutionLatency: latencyStats?.avg || 0,
      p95ExecutionLatency: latencyStats?.p95 || 0,
      p99ExecutionLatency: latencyStats?.p99 || 0,
      successRate,
      tradesPerHour: tradesPerHour?.rate || 0,
      listingsPerHour: listingsPerHour?.rate || 0,
    };
  }
);
