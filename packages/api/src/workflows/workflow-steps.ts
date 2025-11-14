import { createStep } from "@mastra/core/workflows";
import { Effect } from "effect";
import { z } from "zod";
import { mexcClient } from "../services/mexc-client";
import { orderValidator } from "../services/order-validator";
import { riskManager } from "../services/risk-manager";

/**
 * Input schema for order execution workflow
 */
export const orderExecutionInputSchema = z.object({
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  price: z.number().optional(),
  orderType: z.enum(["market", "limit"]),
  stopLoss: z.number().optional(),
  portfolioValue: z.number().positive(),
  dailyPnL: z.number().default(0),
});

/**
 * Output schema for validation step
 */
export const validationOutputSchema = z.object({
  validated: z.boolean(),
  signal: orderExecutionInputSchema,
  errors: z.array(z.string()).optional(),
});

/**
 * Output schema for risk check step
 */
export const riskCheckOutputSchema = z.object({
  approved: z.boolean(),
  adjustedQuantity: z.number().optional(),
  reason: z.string(),
});

/**
 * Output schema for order execution step
 */
export const orderExecutionOutputSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  executedQty: z.number(),
  executedPrice: z.number(),
});

/**
 * Validation step - validates order parameters
 */
export const signalValidationStep = createStep({
  id: "validate-signal",
  inputSchema: orderExecutionInputSchema,
  outputSchema: validationOutputSchema,
  execute: async ({ inputData }) => {
    const errors: string[] = [];

    // Validate symbol is enabled
    const isEnabled = await Effect.runPromise(
      orderValidator.isSymbolEnabled(inputData.symbol)
    );
    if (!isEnabled) {
      errors.push("Symbol is not enabled for trading");
    }

    // Validate order parameters
    const price =
      inputData.price ??
      (await Effect.runPromise(mexcClient.getTicker(inputData.symbol)).then(
        (ticker) => Number.parseFloat(ticker.price)
      ));

    const validation = await Effect.runPromise(
      orderValidator.validate(inputData.symbol, price, inputData.quantity)
    );

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    return {
      validated: errors.length === 0,
      signal: inputData,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
  retries: 3,
});

/**
 * Risk check step - validates against risk limits
 */
export const riskCheckStep = createStep({
  id: "risk-check",
  outputSchema: riskCheckOutputSchema,
  execute: async ({ inputData }) => {
    const price =
      inputData.signal.price ??
      (await Effect.runPromise(
        mexcClient.getTicker(inputData.signal.symbol)
      ).then((ticker) => Number.parseFloat(ticker.price)));

    const validation = await Effect.runPromise(
      riskManager.validateOrder({
        symbol: inputData.signal.symbol,
        quantity: inputData.signal.quantity,
        price,
        side: inputData.signal.side.toUpperCase() as "BUY" | "SELL",
        stopLoss: inputData.signal.stopLoss,
        portfolioValue: inputData.signal.portfolioValue,
        dailyPnL: inputData.signal.dailyPnL,
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
 * Order execution step - places order on exchange
 */
export const executeOrderStep = createStep({
  id: "execute-order",
  outputSchema: orderExecutionOutputSchema,
  execute: async ({ inputData }) => {
    const qty =
      inputData.adjustedQuantity?.toString() ??
      inputData.signal.quantity.toString();

    let order;
    if (inputData.signal.orderType === "market") {
      order = await Effect.runPromise(
        mexcClient.placeMarketBuyOrder(inputData.signal.symbol, qty)
      );
    } else {
      const price = inputData.signal.price?.toString();
      if (!price) {
        throw new Error("Price required for limit orders");
      }
      order = await Effect.runPromise(
        mexcClient.placeLimitBuyOrder(inputData.signal.symbol, qty, price)
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
 * Confirmation step - logs and confirms order execution
 */
export const confirmationStep = createStep({
  id: "confirmation",
  outputSchema: z.object({
    confirmed: z.boolean(),
    orderId: z.string(),
    executionTime: z.number(),
  }),
  execute: async ({ inputData }) => {
    // Log successful execution
    console.log(
      `Order executed: ${inputData.orderId} for ${inputData.signal.symbol}`
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
 * Rejection step - handles rejected orders
 */
export const rejectionStep = createStep({
  id: "rejection",
  outputSchema: z.object({
    rejected: z.boolean(),
    reason: z.string(),
  }),
  execute: async ({ inputData }) => ({
    rejected: true,
    reason: inputData.errors?.join(", ") ?? "Validation failed",
  }),
});

/**
 * Risk rejection step - handles risk check failures
 */
export const riskRejectionStep = createStep({
  id: "risk-rejection",
  outputSchema: z.object({
    rejected: z.boolean(),
    reason: z.string(),
  }),
  execute: async ({ inputData }) => ({
    rejected: true,
    reason: inputData.reason,
  }),
});
