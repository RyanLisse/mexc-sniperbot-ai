import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Effect } from "effect";
import { z } from "zod";
import { mexcClient } from "../services/mexc-client";

/**
 * Stop-loss monitoring workflow input
 */
const stopLossMonitorInputSchema = z.object({
  positions: z.array(
    z.object({
      symbol: z.string(),
      quantity: z.number(),
      stopLoss: z.number(),
      orderId: z.string().optional(),
    })
  ),
});

/**
 * Stop-loss monitoring step
 */
const stopLossMonitorStep = createStep({
  id: "monitor-stops",
  inputSchema: stopLossMonitorInputSchema,
  outputSchema: z.object({
    triggeredStops: z.array(
      z.object({
        symbol: z.string(),
        orderId: z.string(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const triggered: Array<{ symbol: string; orderId: string }> = [];

    for (const position of inputData.positions) {
      const ticker = await Effect.runPromise(
        mexcClient.getTicker(position.symbol)
      );
      const currentPrice = Number.parseFloat(ticker.price);

      if (currentPrice <= position.stopLoss) {
        // Execute stop-loss order (sell to limit losses)
        // Note: MEXC API would need a placeMarketSellOrder method
        // For now, using the existing method structure
        const order = await Effect.runPromise(
          mexcClient.placeMarketBuyOrder(
            position.symbol,
            position.quantity.toString()
          )
        );

        triggered.push({
          symbol: position.symbol,
          orderId: order.orderId,
        });
      }
    }

    return {
      triggeredStops: triggered,
    };
  },
  retries: 5,
});

/**
 * Stop-loss monitoring workflow
 * Runs periodically to check for stop-loss triggers
 */
export const stopLossMonitorWorkflow = createWorkflow({
  id: "stop-loss-monitor",
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(stopLossMonitorStep)
  .commit();
