import { createWorkflow } from "@mastra/core/workflows";
import {
  confirmationStep,
  executeOrderStep,
  rejectionStep,
  riskCheckStep,
  riskRejectionStep,
  signalValidationStep,
} from "./workflow-steps";

/**
 * Order execution workflow
 * Implements: validate → risk-check → execute → confirm
 * With automatic retries and state snapshots
 */
export const orderExecutionWorkflow = createWorkflow({
  id: "order-execution",
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(signalValidationStep)
  .branch([
    [async ({ inputData }) => !inputData.validated, rejectionStep],
    [async ({ inputData }) => inputData.validated, riskCheckStep],
  ])
  .branch([
    [async ({ inputData }) => !inputData.approved, riskRejectionStep],
    [async ({ inputData }) => inputData.approved, executeOrderStep],
  ])
  .then(confirmationStep)
  .commit();
