import { tradeLog } from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../lib/pino-logger";

/**
 * Trade Log Service
 * Creates immutable trade execution logs
 */

export type CreateTradeLogParams = {
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  executedQty: number;
  executedPrice: number;
  quoteQty: number;
  commission?: number;
  commissionAsset?: string;
  exchangeResponse: Record<string, unknown>;
  latencyMs?: number;
};

export async function createTradeLog(params: CreateTradeLogParams) {
  const now = new Date();

  const [log] = await db
    .insert(tradeLog)
    .values({
      orderId: params.orderId,
      symbol: params.symbol,
      side: params.side,
      executedQty: params.executedQty.toString(),
      executedPrice: params.executedPrice.toString(),
      quoteQty: params.quoteQty.toString(),
      commission: params.commission?.toString(),
      commissionAsset: params.commissionAsset,
      exchangeResponse: params.exchangeResponse,
      latencyMs: params.latencyMs,
      timestamp: now,
    })
    .returning();

  logger.info(
    {
      event: "trade_log_created",
      logId: log.id,
      orderId: params.orderId,
      symbol: params.symbol,
      executedQty: params.executedQty,
      executedPrice: params.executedPrice,
      latencyMs: params.latencyMs,
    },
    `Trade log created: ${log.id}`
  );

  return log;
}

export async function getLogsByOrderId(orderId: string) {
  return db.select().from(tradeLog).where(eq(tradeLog.orderId, orderId));
}
