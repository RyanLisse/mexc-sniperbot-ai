import type { ConfigurationParams } from "../types/bot";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface SafetyConstraints {
  tradesThisHour: number;
  spentToday: number;
  config: ConfigurationParams;
}

/**
 * Validates trading safety constraints before order execution
 */
export class SafetyValidator {
  /**
   * Check if a new trade is allowed based on configured limits
   */
  static checkTradeAllowed(constraints: SafetyConstraints): SafetyCheckResult {
    const { tradesThisHour, spentToday, config } = constraints;

    // Safety master switch check
    if (!config.safetyEnabled) {
      return { allowed: true };
    }

    // Check trades per hour limit
    if (tradesThisHour >= config.maxTradesPerHour) {
      return {
        allowed: false,
        reason: `SAFETY_CONSTRAINT: Max trades per hour reached (${tradesThisHour}/${config.maxTradesPerHour})`,
      };
    }

    // Check daily spending limit
    if (spentToday + config.quoteAmount > config.maxDailySpend) {
      return {
        allowed: false,
        reason: `SAFETY_CONSTRAINT: Daily spending limit exceeded (${spentToday + config.quoteAmount}/${config.maxDailySpend})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate recvWindow parameter for MEXC API
   */
  static validateRecvWindow(recvWindow: number): SafetyCheckResult {
    // MEXC requires recvWindow <= 1000ms
    if (recvWindow > 1000) {
      return {
        allowed: false,
        reason: `RECV_WINDOW_INVALID: recvWindow must be <= 1000ms (got ${recvWindow}ms)`,
      };
    }

    if (recvWindow <= 0) {
      return {
        allowed: false,
        reason: `RECV_WINDOW_INVALID: recvWindow must be positive (got ${recvWindow}ms)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if signal is still fresh enough to trade
   */
  static checkSignalFreshness(
    detectedAt: Date,
    freshnessDeadline: Date
  ): SafetyCheckResult {
    const now = new Date();

    if (now > freshnessDeadline) {
      const staleDuration = now.getTime() - freshnessDeadline.getTime();
      return {
        allowed: false,
        reason: `SIGNAL_STALE: Signal exceeded freshness deadline by ${staleDuration}ms`,
      };
    }

    return { allowed: true };
  }
}
