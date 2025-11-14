import type { BotRun } from "@mexc-sniperbot-ai/db";
import { api } from "encore.dev/api";
import { BotStateManager } from "../lib/bot-state-manager";
import { BotRunService } from "../services/bot-run-service";
import { ConfigurationService } from "../services/configuration-service";
import type { RunMetrics } from "../types/bot";

interface StartBotRequest {
  configurationId: string;
  operatorId: string;
}

interface StartBotResponse {
  run: BotRun;
  message: string;
}

interface StopBotRequest {
  runId?: string;
}

interface StopBotResponse {
  run: BotRun;
  message: string;
}

interface GetBotStatusResponse {
  run: BotRun | null;
  metrics: RunMetrics | null;
  isRunning: boolean;
}

/**
 * Start the trading bot with a specific configuration
 */
export const startBot = api(
  { method: "POST", path: "/bot/start", expose: true },
  async (req: StartBotRequest): Promise<StartBotResponse> => {
    const stateManager = BotStateManager.getInstance();

    // Check if bot is already running
    if (stateManager.getStatus() === "running") {
      throw new Error("Bot is already running");
    }

    // Validate configuration exists
    const config = await ConfigurationService.getById(req.configurationId);
    if (!config) {
      throw new Error(`Configuration not found: ${req.configurationId}`);
    }

    // Check for existing active run
    const existingRun = await BotRunService.getActive(req.configurationId);
    if (existingRun) {
      throw new Error(
        `Bot is already running with configuration: ${req.configurationId}`
      );
    }

    // Create new bot run
    const run = await BotRunService.create({
      configurationId: req.configurationId,
      operatorId: req.operatorId,
      status: "starting",
    });

    // Update state manager
    stateManager.transition("starting", run.id);

    // TODO: Initialize bot orchestrator (T034)
    // For now, immediately transition to running
    const updatedRun = await BotRunService.updateStatus(run.id, "running");
    stateManager.transition("running");

    return {
      run: updatedRun,
      message: "Bot started successfully",
    };
  }
);

/**
 * Stop the trading bot gracefully
 */
export const stopBot = api(
  { method: "POST", path: "/bot/stop", expose: true },
  async (req: StopBotRequest): Promise<StopBotResponse> => {
    const stateManager = BotStateManager.getInstance();

    // Get current run
    const runId = req.runId || stateManager.getCurrentRunId();
    if (!runId) {
      throw new Error("No active bot run found");
    }

    // Transition to stopping
    stateManager.transition("stopping");

    // TODO: Implement graceful shutdown (T036)
    // For now, immediately transition to stopped
    const run = await BotRunService.updateStatus(runId, "stopped");
    stateManager.transition("stopped");

    return {
      run,
      message: "Bot stopped successfully",
    };
  }
);

/**
 * Get current bot status and metrics
 */
export const getBotStatus = api(
  { method: "GET", path: "/bot/status", expose: true },
  async (): Promise<GetBotStatusResponse> => {
    const stateManager = BotStateManager.getInstance();
    const runId = stateManager.getCurrentRunId();

    let run: BotRun | null = null;
    let metrics: RunMetrics | null = null;

    if (runId) {
      // Get run details
      const runs = await BotRunService.getActive("");
      run = runs;

      // TODO: Get actual metrics (T039)
      metrics = {
        tradesThisHour: 0,
        spentToday: 0,
        queueDepth: 0,
        avgLatencyMs: 0,
      };
    }

    return {
      run,
      metrics,
      isRunning: stateManager.getStatus() === "running",
    };
  }
);
