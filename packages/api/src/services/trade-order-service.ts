import { tradeAttempt } from "@mexc-sniperbot-ai/db";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../lib/pino-logger";

/**
 * Trade Order Service
 * Manages trade order lifecycle
 */

export type CreateTradeOrderParams = {
  runId: string;
  signalId: string;
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  quantity?: number;
  quoteQty?: number;
  detectedAt: Date;
};

export type UpdateOrderStatusParams = {
  orderId: string;
  status: string;
  exchangeOrderId?: string;
  filledQty?: number;
  avgPrice?: number;
  submittedAt?: Date;
  completedAt?: Date;
};

export async function createTradeOrder(params: CreateTradeOrderParams) {
  const now = new Date();

  const [order] = await db
    .insert(tradeAttempt)
    .values({
      runId: params.runId,
      signalId: params.signalId,
      symbol: params.symbol,
      side: params.side,
      orderType: params.orderType,
      quantity: params.quantity,
      quoteQty: params.quoteQty,
      status: "pending",
      createdAt: now,
      detectedAt: params.detectedAt,
    })
    .returning();

  logger.info(
    {
      event: "trade_order_created",
      orderId: order.id,
      symbol: params.symbol,
      side: params.side,
    },
    `Trade order created: ${order.id}`
  );

  return order;
}

export async function updateOrderStatus(params: UpdateOrderStatusParams) {
  const [updated] = await db
    .update(tradeAttempt)
    .set({
      status: params.status,
      exchangeOrderId: params.exchangeOrderId,
      filledQty: params.filledQty,
      avgPrice: params.avgPrice ? params.avgPrice.toString() : undefined,
      submittedAt: params.submittedAt,
      completedAt: params.completedAt,
    })
    .where(eq(tradeAttempt.id, params.orderId))
    .returning();

  logger.debug(
    {
      event: "trade_order_updated",
      orderId: params.orderId,
      status: params.status,
    },
    `Order status updated: ${params.status}`
  );

  return updated;
}

export async function getOrdersByRun(runId: string) {
  return db
    .select()
    .from(tradeAttempt)
    .where(eq(tradeAttempt.runId, runId))
    .orderBy(desc(tradeAttempt.createdAt));
}

export async function calculateLatency(orderId: string) {
  const [order] = await db
    .select()
    .from(tradeAttempt)
    .where(eq(tradeAttempt.id, orderId))
    .limit(1);

  if (!(order && order.detectedAt && order.submittedAt)) {
    return null;
  }

  const latencyMs = order.submittedAt.getTime() - order.detectedAt.getTime();

  logger.debug(
    {
      orderId,
      latencyMs,
    },
    `Calculated order latency: ${latencyMs}ms`
  );

  return latencyMs;
}
