import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { orderExecutionWorkflow } from "../workflows/order-execution-workflow";
import { positionSizingWorkflow } from "../workflows/risk-management-workflow";
import { sellExecutionWorkflow } from "../workflows/sell-execution-workflow";
import { stopLossMonitorWorkflow } from "../workflows/stop-loss-monitor-workflow";
import { getDatabaseConfig } from "./env";

/**
 * Mastra configuration with PostgreSQL storage
 * Provides workflow state snapshots for crash recovery
 */
let mastraInstance: Mastra | null = null;

/**
 * Get or create Mastra instance
 */
export function getMastraInstance(): Mastra {
  if (mastraInstance) {
    return mastraInstance;
  }

  const dbConfig = getDatabaseConfig();

  mastraInstance = new Mastra({
    storage: new PostgresStore({
      connectionString: dbConfig.url,
    }),
    workflows: {
      "order-execution": orderExecutionWorkflow,
      "sell-execution": sellExecutionWorkflow,
      "position-sizing": positionSizingWorkflow,
      "stop-loss-monitor": stopLossMonitorWorkflow,
    },
  });

  return mastraInstance;
}

/**
 * Initialize Mastra (call on application startup)
 */
export async function initializeMastra(): Promise<void> {
  const _mastra = getMastraInstance();
  // Mastra will automatically connect to PostgreSQL
  // Workflows are registered in getMastraInstance()
}
