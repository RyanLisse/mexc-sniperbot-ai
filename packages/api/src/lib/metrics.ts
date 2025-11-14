import { db, tradeAttempt } from "@mexc-sniperbot-ai/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { RunMetrics } from "../types/bot";

/**
 * Metrics helper for bot monitoring
 */
export class MetricsCollector {
  /**
   * Get trades count in the last hour
   */
  static async getTradesThisHour(configurationId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeAttempt)
      .where(
        and(
          eq(tradeAttempt.configurationId, configurationId),
          gte(tradeAttempt.submittedAt, oneHourAgo)
        )
      );

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get total spent today
   */
  static async getSpentToday(configurationId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        total: sql<string>`sum(CAST(executed_quantity AS DECIMAL) * CAST(executed_price AS DECIMAL))`,
      })
      .from(tradeAttempt)
      .where(
        and(
          eq(tradeAttempt.configurationId, configurationId),
          eq(tradeAttempt.status, "filled"),
          gte(tradeAttempt.submittedAt, startOfDay)
        )
      );

    return Number(result[0]?.total ?? 0);
  }

  /**
   * Get pending orders queue depth
   */
  static async getQueueDepth(configurationId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeAttempt)
      .where(
        and(
          eq(tradeAttempt.configurationId, configurationId),
          eq(tradeAttempt.status, "pending")
        )
      );

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get average order latency
   */
  static async getAverageLatency(configurationId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await db
      .select({ avg: sql<number>`avg(latency_ms)` })
      .from(tradeAttempt)
      .where(
        and(
          eq(tradeAttempt.configurationId, configurationId),
          gte(tradeAttempt.submittedAt, oneHourAgo)
        )
      );

    return Number(result[0]?.avg ?? 0);
  }

  /**
   * Collect all metrics for a configuration
   */
  static async collectMetrics(configurationId: string): Promise<RunMetrics> {
    const [tradesThisHour, spentToday, queueDepth, avgLatencyMs] =
      await Promise.all([
        MetricsCollector.getTradesThisHour(configurationId),
        MetricsCollector.getSpentToday(configurationId),
        MetricsCollector.getQueueDepth(configurationId),
        MetricsCollector.getAverageLatency(configurationId),
      ]);

    return {
      tradesThisHour,
      spentToday,
      queueDepth,
      avgLatencyMs,
    };
  }
}
