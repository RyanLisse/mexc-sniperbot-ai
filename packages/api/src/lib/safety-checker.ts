import { tradeLog } from "@mexc-sniperbot-ai/db";
import { and, gte, sql } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "./pino-logger";

export type SafetyCheckResult = {
  canTrade: boolean;
  reason?: string;
  tradesThisHour?: number;
  spentToday?: number;
};

export type SafetyLimits = {
  maxTradesPerHour: number;
  maxDailySpend: number;
};

/**
 * Safety Constraint Checker
 * Enforces trading limits to prevent over-trading
 */
export class SafetyChecker {
  /**
   * Check if trade is allowed under safety constraints
   */
  async check(params: {
    runId: string;
    quoteAmount: number;
    limits: SafetyLimits;
  }): Promise<SafetyCheckResult> {
    try {
      const [tradesThisHour, spentToday] = await Promise.all([
        this.getTradesThisHour(params.runId),
        this.getSpentToday(params.runId),
      ]);

      // Check hourly limit
      if (tradesThisHour >= params.limits.maxTradesPerHour) {
        logger.warn(
          {
            tradesThisHour,
            limit: params.limits.maxTradesPerHour,
          },
          "Hourly trade limit exceeded"
        );

        return {
          canTrade: false,
          reason: `Hourly limit exceeded (${tradesThisHour}/${params.limits.maxTradesPerHour})`,
          tradesThisHour,
          spentToday,
        };
      }

      // Check daily spend limit
      const projectedSpend = spentToday + params.quoteAmount;
      if (projectedSpend > params.limits.maxDailySpend) {
        logger.warn(
          {
            spentToday,
            quoteAmount: params.quoteAmount,
            projectedSpend,
            limit: params.limits.maxDailySpend,
          },
          "Daily spend limit would be exceeded"
        );

        return {
          canTrade: false,
          reason: `Daily spend limit would be exceeded ($${projectedSpend}/$${params.limits.maxDailySpend})`,
          tradesThisHour,
          spentToday,
        };
      }

      logger.debug(
        {
          tradesThisHour,
          spentToday,
          quoteAmount: params.quoteAmount,
          limits: params.limits,
        },
        "Safety check passed"
      );

      return {
        canTrade: true,
        tradesThisHour,
        spentToday,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Safety check failed"
      );

      // Fail safe - deny trade on error
      return {
        canTrade: false,
        reason: "Safety check error",
      };
    }
  }

  /**
   * Get number of trades in the last hour
   */
  private async getTradesThisHour(runId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeLog)
      .where(and(gte(tradeLog.timestamp, oneHourAgo)));

    return Number(result[0]?.count || 0);
  }

  /**
   * Get total amount spent today
   */
  private async getSpentToday(runId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db
      .select({ total: sql<string>`sum(${tradeLog.quoteQty})` })
      .from(tradeLog)
      .where(and(gte(tradeLog.timestamp, startOfDay)));

    return Number(result[0]?.total || 0);
  }
}

export const safetyChecker = new SafetyChecker();
