import {
  type BotRun,
  botRun,
  db,
  type NewBotRun,
  tradingConfiguration,
} from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { api } from "encore.dev/api";

// Keep bot status and metrics types aligned with the frontend
export type BotStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed";

export type BotMetrics = {
  tradesThisHour: number;
  spentToday: number;
  queueDepth: number;
  avgLatencyMs: number;
  successRate: number;
};

export type StartBotRequest = {
  configurationId: string;
};

export type StopBotRequest = {
  runId?: string;
};

export type BotStatusResponse = {
  status: BotStatus;
  runId?: string;
  configurationId?: string;
  configurationName?: string;
  startedAt?: string;
  lastHeartbeat?: string;
  errorMessage?: string;
  metrics?: BotMetrics;
};

// In-memory bot state manager, mirroring the behavior from the API package
const VALID_TRANSITIONS: Record<BotStatus, BotStatus[]> = {
  starting: ["running", "failed"],
  running: ["stopping", "failed"],
  stopping: ["stopped", "failed"],
  stopped: [],
  failed: [],
};

class BotStateManager {
  private static instance: BotStateManager;
  private currentStatus: BotStatus = "stopped";
  private currentRunId: string | null = null;

  private constructor() {}

  static getInstance(): BotStateManager {
    if (!BotStateManager.instance) {
      BotStateManager.instance = new BotStateManager();
    }
    return BotStateManager.instance;
  }

  private canTransition(from: BotStatus, to: BotStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from];
    return allowedTransitions.includes(to);
  }

  transition(to: BotStatus, runId?: string): void {
    if (!this.canTransition(this.currentStatus, to)) {
      throw new Error(
        `Invalid status transition: ${this.currentStatus} → ${to}`
      );
    }
    this.currentStatus = to;
    if (runId) {
      this.currentRunId = runId;
    }
  }

  getStatus(): BotStatus {
    return this.currentStatus;
  }

  getCurrentRunId(): string | null {
    return this.currentRunId;
  }
}

const stateManager = BotStateManager.getInstance();

const DEFAULT_OPERATOR_ID = "web-ui";

async function createBotRun(run: NewBotRun): Promise<BotRun> {
  const [created] = await db.insert(botRun).values(run).returning();
  if (!created) {
    throw new Error("Failed to create bot run");
  }
  return created;
}

async function updateBotRunStatus(
  id: string,
  status: BotStatus,
  errorMessage?: string
): Promise<BotRun> {
  const updates: Partial<BotRun> = {
    status,
    lastHeartbeat: new Date(),
  };

  if (status === "stopped" || status === "failed") {
    updates.stoppedAt = new Date();
  }

  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  const [updated] = await db
    .update(botRun)
    .set(updates)
    .where(eq(botRun.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Bot run not found: ${id}`);
  }

  return updated;
}

async function getActiveRun(configurationId: string): Promise<BotRun | null> {
  const [run] = await db
    .select()
    .from(botRun)
    .where(
      and(
        eq(botRun.configurationId, configurationId),
        eq(botRun.status, "running")
      )
    )
    .limit(1);

  return run || null;
}

function buildStatusResponse(run: BotRun | null): BotStatusResponse {
  const status = stateManager.getStatus();

  const metrics: BotMetrics = {
    tradesThisHour: 0,
    spentToday: 0,
    queueDepth: 0,
    avgLatencyMs: 0,
    successRate: 1,
  };

  return {
    status,
    runId: run?.id,
    configurationId: run?.configurationId,
    configurationName: run?.configurationId
      ? `Configuration ${run.configurationId.slice(0, 8)}`
      : undefined,
    startedAt: run?.startedAt?.toISOString(),
    lastHeartbeat: run?.lastHeartbeat?.toISOString(),
    errorMessage: run?.errorMessage ?? undefined,
    metrics,
  };
}

async function getLatestRun(): Promise<BotRun | null> {
  const [run] = await db
    .select()
    .from(botRun)
    .orderBy(desc(botRun.startedAt))
    .limit(1);

  return run || null;
}

/**
 * POST /bot/start
 * Start the trading bot with a specific configuration.
 */
export const startBot = api(
  { method: "POST", path: "/bot/start", expose: true },
  async (req: StartBotRequest): Promise<BotStatusResponse> => {
    if (stateManager.getStatus() === "running") {
      throw new Error("Bot is already running");
    }

    const [config] = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.id, req.configurationId))
      .limit(1);

    if (!config) {
      throw new Error(`Configuration not found: ${req.configurationId}`);
    }

    const existingRun = await getActiveRun(req.configurationId);
    if (existingRun) {
      throw new Error(
        `Bot is already running with configuration: ${req.configurationId}`
      );
    }

    const run = await createBotRun({
      configurationId: req.configurationId,
      operatorId: DEFAULT_OPERATOR_ID,
      status: "starting",
    });

    stateManager.transition("starting", run.id);

    const updatedRun = await updateBotRunStatus(run.id, "running");
    stateManager.transition("running");

    return buildStatusResponse(updatedRun);
  }
);

/**
 * POST /bot/stop
 * Stop the trading bot gracefully.
 */
export const stopBot = api(
  { method: "POST", path: "/bot/stop", expose: true },
  async (req: StopBotRequest): Promise<BotStatusResponse> => {
    const runId = req.runId || stateManager.getCurrentRunId();
    if (!runId) {
      throw new Error("No active bot run found");
    }

    stateManager.transition("stopping");

    const run = await updateBotRunStatus(runId, "stopped");
    stateManager.transition("stopped");

    return buildStatusResponse(run);
  }
);

/**
 * GET /bot/status
 * Get current bot status and metrics.
 */
export const getBotStatus = api(
  { method: "GET", path: "/bot/status", expose: true },
  async (): Promise<BotStatusResponse> => {
    const run = await getLatestRun();

    return buildStatusResponse(run);
  }
);
