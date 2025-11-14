import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Position sizing workflow input
 */
const positionSizingInputSchema = z.object({
  winRate: z.number().min(0).max(1),
  riskRewardRatio: z.number().positive(),
  accountBalance: z.number().positive(),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
});

/**
 * Position sizing step using Kelly Criterion
 */
const positionSizingStep = createStep({
  id: "calculate-position",
  inputSchema: positionSizingInputSchema,
  outputSchema: z.object({
    positionSize: z.number(),
    kellyFraction: z.number(),
    maxLoss: z.number(),
  }),
  execute: async ({ inputData }) => {
    const result = await import("../services/position-sizer").then((m) =>
      m.positionSizer.calculateKellyPosition(
        inputData.winRate,
        inputData.riskRewardRatio,
        inputData.accountBalance,
        inputData.entryPrice,
        inputData.stopLoss
      )
    );

    return {
      positionSize: result.positionSize,
      kellyFraction: result.kellyFraction,
      maxLoss: result.maxLoss,
    };
  },
});

/**
 * Position sizing workflow
 */
export const positionSizingWorkflow = createWorkflow({
  id: "position-sizing",
  retryConfig: {
    attempts: 2,
    delay: 500,
  },
})
  .then(positionSizingStep)
  .commit();
