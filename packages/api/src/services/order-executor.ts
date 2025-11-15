import { Spot } from "mexc-api-sdk";
import { MexcApiKey, MexcApiSecret } from "../../secrets";
import { logger } from "../lib/pino-logger";

/**
 * MEXC Order Executor
 * Executes MARKET orders via mexc-api-sdk
 */

export type ExecuteOrderParams = {
  symbol: string;
  side: "BUY" | "SELL";
  quoteOrderQty: number; // Amount in USDT
  recvWindow?: number;
};

export type OrderResult = {
  orderId: string;
  symbol: string;
  status: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
  transactTime: number;
};

export class OrderExecutor {
  private readonly client: Spot;

  constructor() {
    this.client = new Spot(MexcApiKey(), MexcApiSecret());
  }

  /**
   * Execute a MARKET order
   * Uses quoteOrderQty (spend exact USDT amount)
   */
  async executeMarketOrder(params: ExecuteOrderParams): Promise<OrderResult> {
    const startTime = Date.now();

    try {
      logger.info(
        {
          event: "order_execution_start",
          symbol: params.symbol,
          side: params.side,
          quoteOrderQty: params.quoteOrderQty,
        },
        `Executing MARKET ${params.side} for ${params.symbol}`
      );

      const response = await this.client.newOrder(
        params.symbol,
        params.side,
        "MARKET",
        {
          quoteOrderQty: params.quoteOrderQty.toString(),
          recvWindow: params.recvWindow ?? 1000,
          timestamp: Date.now(),
        }
      );

      const duration = Date.now() - startTime;

      logger.info(
        {
          event: "order_execution_success",
          orderId: response.orderId,
          symbol: params.symbol,
          executedQty: response.executedQty,
          avgPrice: this.calculateAvgPrice(response),
          duration,
        },
        `Order executed successfully in ${duration}ms`
      );

      return response as OrderResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          event: "order_execution_error",
          symbol: params.symbol,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        "Order execution failed"
      );

      throw error;
    }
  }

  /**
   * Calculate average fill price from order response
   */
  private calculateAvgPrice(order: OrderResult): number {
    if (!order.fills || order.fills.length === 0) {
      return 0;
    }

    let totalValue = 0;
    let totalQty = 0;

    for (const fill of order.fills) {
      const price = Number.parseFloat(fill.price);
      const qty = Number.parseFloat(fill.qty);
      totalValue += price * qty;
      totalQty += qty;
    }

    return totalQty > 0 ? totalValue / totalQty : 0;
  }

  /**
   * Get order details (for verification)
   */
  async getOrder(symbol: string, orderId: string): Promise<OrderResult> {
    try {
      return (await this.client.queryOrder(symbol, { orderId })) as OrderResult;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          symbol,
          orderId,
        },
        "Failed to query order"
      );
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const orderExecutor = new OrderExecutor();
