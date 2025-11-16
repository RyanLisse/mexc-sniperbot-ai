import { botRun, db, tradingConfiguration, } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { api } from "encore.dev/api";
// In-memory bot state manager, mirroring the behavior from the API package
const VALID_TRANSITIONS = {
    starting: ["running", "failed"],
    running: ["stopping", "failed"],
    stopping: ["stopped", "failed"],
    stopped: [],
    failed: [],
};
class BotStateManager {
    static instance;
    currentStatus = "stopped";
    currentRunId = null;
    constructor() { }
    static getInstance() {
        if (!BotStateManager.instance) {
            BotStateManager.instance = new BotStateManager();
        }
        return BotStateManager.instance;
    }
    canTransition(from, to) {
        const allowedTransitions = VALID_TRANSITIONS[from];
        return allowedTransitions.includes(to);
    }
    transition(to, runId) {
        if (!this.canTransition(this.currentStatus, to)) {
            throw new Error(`Invalid status transition: ${this.currentStatus} → ${to}`);
        }
        this.currentStatus = to;
        if (runId) {
            this.currentRunId = runId;
        }
    }
    getStatus() {
        return this.currentStatus;
    }
    getCurrentRunId() {
        return this.currentRunId;
    }
}
const stateManager = BotStateManager.getInstance();
const DEFAULT_OPERATOR_ID = "web-ui";
async function createBotRun(run) {
    const [created] = await db.insert(botRun).values(run).returning();
    if (!created) {
        throw new Error("Failed to create bot run");
    }
    return created;
}
async function updateBotRunStatus(id, status, errorMessage) {
    const updates = {
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
async function getActiveRun(configurationId) {
    const [run] = await db
        .select()
        .from(botRun)
        .where(and(eq(botRun.configurationId, configurationId), eq(botRun.status, "running")))
        .limit(1);
    return run || null;
}
function buildStatusResponse(run) {
    const status = stateManager.getStatus();
    const metrics = {
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
async function getLatestRun() {
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
export const startBot = api({ method: "POST", path: "/bot/start", expose: true }, async (req) => {
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
        throw new Error(`Bot is already running with configuration: ${req.configurationId}`);
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
});
/**
 * POST /bot/stop
 * Stop the trading bot gracefully.
 */
export const stopBot = api({ method: "POST", path: "/bot/stop", expose: true }, async (req) => {
    const runId = req.runId || stateManager.getCurrentRunId();
    if (!runId) {
        throw new Error("No active bot run found");
    }
    stateManager.transition("stopping");
    const run = await updateBotRunStatus(runId, "stopped");
    stateManager.transition("stopped");
    return buildStatusResponse(run);
});
/**
 * GET /bot/status
 * Get current bot status and metrics.
 */
export const getBotStatus = api({ method: "GET", path: "/bot/status", expose: true }, async () => {
    const run = await getLatestRun();
    return buildStatusResponse(run);
});
//# sourceMappingURL=bot-control.js.map