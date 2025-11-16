export type BotStatus = "starting" | "running" | "stopping" | "stopped" | "failed";
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
/**
 * POST /bot/start
 * Start the trading bot with a specific configuration.
 */
export declare const startBot: (req: StartBotRequest) => Promise<BotStatusResponse>;
/**
 * POST /bot/stop
 * Stop the trading bot gracefully.
 */
export declare const stopBot: (req: StopBotRequest) => Promise<BotStatusResponse>;
/**
 * GET /bot/status
 * Get current bot status and metrics.
 */
export declare const getBotStatus: (req: unknown) => Promise<BotStatusResponse>;
