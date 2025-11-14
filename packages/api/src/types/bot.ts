// Bot status enum
export type BotStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed";

// Configuration parameters for bot initialization
export interface ConfigurationParams {
  symbols: string[];
  quoteAmount: number;
  maxTradesPerHour: number;
  maxDailySpend: number;
  recvWindow: number;
  safetyEnabled: boolean;
}

// Runtime metrics for bot monitoring
export interface RunMetrics {
  tradesThisHour: number;
  spentToday: number;
  queueDepth: number;
  avgLatencyMs: number;
}
