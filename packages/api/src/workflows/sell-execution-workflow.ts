import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Effect } from "effect";
import { z } from "zod";
import { mexcClient } from "../services/mexc-client";
import { positionTracker } from "../services/position-tracker";
import { riskManager } from "../services/risk-manager";

/**
 * Sell signal input schema
 */
const sellSignalInputSchema = z.object({
  symbol: z.string(),
  side: z.literal("sell"),
  quantity: z.number(),
  price: z.number().optional(),
  orderType: z.enum(["market", "limit"]),
  portfolioValue: z.number(),
  dailyPnL: z.number(),
  sellReason: z.string().optional(), // "PROFIT_TARGET", "STOP_LOSS", "TIME_BASED", "MANUAL"
  parentTradeId: z.string().optional(), // Link to buy order
});

/**
 * Sell validation output schema
 */
const sellValidationOutputSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).optional(),
});

/**
 * Sell risk check output schema
 */
const sellRiskCheckOutputSchema = z.object({
  approved: z.boolean(),
  adjustedQuantity: z.number().optional(),
  reason: z.string(),
});

/**
 * Sell order execution output schema
 */
const sellOrderExecutionOutputSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  executedQty: z.number(),
  executedPrice: z.number(),
});

/**
 * Sell confirmation output schema
 */
const sellConfirmationOutputSchema = z.object({
  confirmed: z.boolean(),
  orderId: z.string(),
  executionTime: z.number(),
});

/**
 * Validate sell signal step - validates position exists and has sufficient quantity
 */
export const validateSellSignalStep = createStep({
  id: "validate-sell-signal",
  outputSchema: sellValidationOutputSchema,
  execute: async ({ inputData }) => {
    const position = await Effect.runPromise(
      positionTracker.getPosition(inputData.symbol)
    );

    const errors: string[] = [];

    if (position) {
      // Check if we have sufficient quantity to sell
      if (inputData.quantity > position.quantity) {
        errors.push(
          `Insufficient quantity: requested ${inputData.quantity}, available ${position.quantity}`
        );
      }
    } else {
      errors.push(`No open position found for ${inputData.symbol}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
  retries: 3,
});

/**
 * Risk check step for sell - validates against risk limits
 */
export const riskCheckSellStep = createStep({
  id: "risk-check-sell",
  outputSchema: sellRiskCheckOutputSchema,
  execute: async ({ inputData }) => {
    const price =
      inputData.price ??
      (await Effect.runPromise(mexcClient.getTicker(inputData.symbol)).then(
        (ticker) => Number.parseFloat(ticker.price)
      ));

    const validation = await Effect.runPromise(
      riskManager.validateOrder({
        symbol: inputData.symbol,
        quantity: inputData.quantity,
        price,
        side: "SELL",
        stopLoss: undefined, // Not applicable for sell orders
        portfolioValue: inputData.portfolioValue,
        dailyPnL: inputData.dailyPnL,
      })
    );

    return {
      approved: validation.approved,
      adjustedQuantity: validation.adjustedQuantity,
      reason: validation.reason,
    };
  },
  retries: 2,
});

/**
 * Execute sell order step - places sell order on exchange
 */
export const executeSellOrderStep = createStep({
  id: "execute-sell-order",
  outputSchema: sellOrderExecutionOutputSchema,
  execute: async ({ inputData }) => {
    const qty =
      inputData.adjustedQuantity?.toString() ??
      inputData.signal.quantity.toString();

    let order;
    if (inputData.signal.orderType === "market") {
      order = await Effect.runPromise(
        mexcClient.placeMarketSellOrder(inputData.signal.symbol, qty)
      );
    } else {
      const price = inputData.signal.price?.toString();
      if (!price) {
        throw new Error("Price required for limit orders");
      }
      order = await Effect.runPromise(
        mexcClient.placeLimitSellOrder(inputData.signal.symbol, qty, price)
      );
    }

    return {
      orderId: order.orderId,
      status: order.status,
      executedQty: Number.parseFloat(order.executedQuantity),
      executedPrice: order.executedPrice
        ? Number.parseFloat(order.executedPrice)
        : 0,
    };
  },
  retries: 5,
});

/**
 * Confirm sell step - logs and confirms sell execution, updates position tracker
 */
export const confirmSellStep = createStep({
  id: "confirm-sell",
  outputSchema: sellConfirmationOutputSchema,
  execute: async ({ inputData }) => {
    // Remove position from tracker
    await Effect.runPromise(
      positionTracker.removePosition(inputData.signal.symbol)
    );

    // Log successful execution
    console.log(
      `Sell order executed: ${inputData.orderId} for ${inputData.signal.symbol} (reason: ${inputData.signal.sellReason || "UNKNOWN"})`
    );

    return {
      confirmed: true,
      orderId: inputData.orderId,
      executionTime: Date.now(),
    };
  },
  retries: 1,
});

/**
 * Sell execution workflow
 * Similar structure to order-execution workflow but for sells
 * Steps: validate → risk-check → execute → confirm
 */
export const sellExecutionWorkflow = createWorkflow({
  id: "sell-execution",
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(validateSellSignalStep)
  .then(riskCheckSellStep)
  .then(executeSellOrderStep)
  .then(confirmSellStep)
  .commit();
