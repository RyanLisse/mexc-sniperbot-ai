import type { BotStatus } from "../types/bot";

/**
 * Valid bot status transitions
 */
const VALID_TRANSITIONS: Record<BotStatus, BotStatus[]> = {
  starting: ["running", "failed"],
  running: ["stopping", "failed"],
  stopping: ["stopped", "failed"],
  stopped: [],
  failed: [],
};

/**
 * Bot state management singleton
 * Handles status transitions and validation
 */
export class BotStateManager {
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

  /**
   * Check if a status transition is valid
   */
  canTransition(from: BotStatus, to: BotStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from];
    return allowedTransitions.includes(to);
  }

  /**
   * Validate and execute status transition
   */
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

  /**
   * Get current bot status
   */
  getStatus(): BotStatus {
    return this.currentStatus;
  }

  /**
   * Get current run ID
   */
  getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    this.currentStatus = "stopped";
    this.currentRunId = null;
  }
}
