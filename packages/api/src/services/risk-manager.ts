import { Effect } from "effect";
import type { TradingError } from "../lib/effect";
import { positionSizer } from "./position-sizer";

/**
 * Risk management configuration
 */
export type RiskConfig = {
  maxPositionSizePercent: number; // 1-2% of portfolio per trade
  maxDailyLossPercent: number; // 5% maximum drawdown
  maxLeverage: number; // 2-3x for conservative trading
  requireStopLoss: boolean;
};

/**
 * Default risk configuration
 */
const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionSizePercent: 0.02, // 2% per position
  maxDailyLossPercent: 0.05, // 5% max daily loss
  maxLeverage: 2, // 2x leverage
  requireStopLoss: true,
};

/**
 * Order validation input
 */
export type OrderValidationInput = {
  symbol: string;
  quantity: number;
  price: number;
  side: "BUY" | "SELL";
  stopLoss?: number;
  portfolioValue: number;
  dailyPnL: number;
};

/**
 * Order validation result
 */
export type OrderValidationResult = {
  approved: boolean;
  adjustedQuantity?: number;
  reason: string;
  riskMetrics: {
    positionSizePercent: number;
    orderValue: number;
    maxLoss: number;
    dailyLossPercent: number;
  };
};

/**
 * Comprehensive risk manager
 * Enforces position sizing, daily loss limits, and stop-loss requirements
 */
export class RiskManager {
  private dailyPnL = 0;
  private readonly config: RiskConfig;

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  /**
   * Validate order against risk limits
   */
  validateOrder = (
    input: OrderValidationInput
  ): Effect.Effect<OrderValidationResult, TradingError> => {
    return Effect.gen(
      function* () {
        const orderValue = input.quantity * input.price;
        const positionSizePercent = orderValue / input.portfolioValue;
        const dailyLossPercent = Math.abs(this.dailyPnL) / input.portfolioValue;

        // Check daily loss limit
        if (dailyLossPercent >= this.config.maxDailyLossPercent) {
          return {
            approved: false,
            reason: `Daily loss limit reached: ${(dailyLossPercent * 100).toFixed(2)}% >= ${(this.config.maxDailyLossPercent * 100).toFixed(2)}%`,
            riskMetrics: {
              positionSizePercent,
              orderValue,
              maxLoss: orderValue,
              dailyLossPercent,
            },
          };
        }

        // Check position size limit
        if (positionSizePercent > this.config.maxPositionSizePercent) {
          // Calculate adjusted quantity
          const maxOrderValue =
            input.portfolioValue * this.config.maxPositionSizePercent;
          const adjustedQuantity = Math.floor(maxOrderValue / input.price);

          return {
            approved: adjustedQuantity > 0,
            adjustedQuantity,
            reason: `Order exceeds max position size: ${(positionSizePercent * 100).toFixed(2)}% > ${(this.config.maxPositionSizePercent * 100).toFixed(2)}%. Adjusted to ${adjustedQuantity}`,
            riskMetrics: {
              positionSizePercent,
              orderValue,
              maxLoss: orderValue,
              dailyLossPercent,
            },
          };
        }

        // Check stop-loss requirement
        if (this.config.requireStopLoss && !input.stopLoss) {
          return {
            approved: false,
            reason: "Stop-loss is required for all orders",
            riskMetrics: {
              positionSizePercent,
              orderValue,
              maxLoss: orderValue,
              dailyLossPercent,
            },
          };
        }

        // Calculate max loss if stop-loss is provided
        let maxLoss = orderValue;
        if (input.stopLoss) {
          const priceRisk = Math.abs(input.price - input.stopLoss);
          maxLoss = input.quantity * priceRisk;
        }

        return {
          approved: true,
          reason: "Risk checks passed",
          riskMetrics: {
            positionSizePercent,
            orderValue,
            maxLoss,
            dailyLossPercent,
          },
        };
      }.bind(this)
    );
  };

  /**
   * Record trade PnL
   */
  recordTrade(pnl: number): void {
    this.dailyPnL += pnl;
  }

  /**
   * Reset daily PnL (call at start of new trading day)
   */
  resetDailyPnL(): void {
    this.dailyPnL = 0;
  }

  /**
   * Get current daily PnL
   */
  getDailyPnL(): number {
    return this.dailyPnL;
  }

  /**
   * Get daily loss percentage
   */
  getDailyLossPercent(portfolioValue: number): number {
    return Math.abs(this.dailyPnL) / portfolioValue;
  }

  /**
   * Check if daily loss limit is reached
   */
  isDailyLossLimitReached(portfolioValue: number): boolean {
    return (
      this.getDailyLossPercent(portfolioValue) >=
      this.config.maxDailyLossPercent
    );
  }

  /**
   * Calculate position size using Kelly Criterion
   */
  calculatePositionSize = (
    winRate: number,
    riskRewardRatio: number,
    accountBalance: number,
    entryPrice: number,
    stopLoss: number
  ): Effect.Effect<number, TradingError> => {
    return Effect.gen(function* () {
      const result = yield* positionSizer.calculateKellyPosition(
        winRate,
        riskRewardRatio,
        accountBalance,
        entryPrice,
        stopLoss
      );

      // Ensure position size doesn't exceed max position size limit
      const maxPositionValue =
        accountBalance * this.config.maxPositionSizePercent;
      const maxPositionSize = Math.floor(maxPositionValue / entryPrice);

      return Math.min(result.positionSize, maxPositionSize);
    });
  };
}

// Export singleton instance
export const riskManager = new RiskManager();
