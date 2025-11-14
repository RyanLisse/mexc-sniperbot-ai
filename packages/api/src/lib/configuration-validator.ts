import type { NewTradingConfiguration } from "@mexc-sniperbot-ai/db";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration validation logic for Encore backend
 */
export class ConfigurationValidator {
  /**
   * Validate configuration parameters
   */
  static validate(config: Partial<NewTradingConfiguration>): ValidationResult {
    const errors: string[] = [];

    // Validate quoteAmount
    if (
      config.maxPurchaseAmount !== undefined &&
      config.maxPurchaseAmount <= 0
    ) {
      errors.push("quoteAmount must be greater than 0");
    }

    // Validate recvWindow
    if (config.recvWindow !== undefined) {
      if (config.recvWindow > 1000) {
        errors.push("recvWindow must be <= 1000ms per MEXC requirements");
      }
      if (config.recvWindow <= 0) {
        errors.push("recvWindow must be positive");
      }
    }

    // Validate symbols format
    if (config.enabledPairs && config.enabledPairs.length > 0) {
      for (const symbol of config.enabledPairs) {
        if (!/^[A-Z0-9]+USDT$/.test(symbol)) {
          errors.push(
            `Invalid symbol format: ${symbol} (must be like BTCUSDT)`
          );
        }
      }
    }

    // Validate maxTradesPerHour
    if (config.maxTradesPerHour !== undefined) {
      if (config.maxTradesPerHour <= 0) {
        errors.push("maxTradesPerHour must be greater than 0");
      }
      if (config.maxTradesPerHour > 100) {
        errors.push("maxTradesPerHour cannot exceed 100");
      }
    }

    // Validate dailySpendingLimit
    if (
      config.dailySpendingLimit !== undefined &&
      config.dailySpendingLimit < 0
    ) {
      errors.push("dailySpendingLimit cannot be negative");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
