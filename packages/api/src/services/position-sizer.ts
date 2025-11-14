import { Effect } from "effect";
import { TradingError } from "../lib/effect";

/**
 * Position sizing using Kelly Criterion
 * Maximizes long-term growth while managing risk
 */
export class PositionSizer {
  /**
   * Calculate optimal position size using Kelly Criterion
   * @param winRate - Historical win rate (0-1)
   * @param riskRewardRatio - Average win / Average loss
   * @param accountBalance - Current account balance
   * @param entryPrice - Entry price for the trade
   * @param stopLoss - Stop loss price
   * @returns Position size and risk metrics
   */
  calculateKellyPosition = (
    winRate: number,
    riskRewardRatio: number,
    accountBalance: number,
    entryPrice: number,
    stopLoss: number
  ): Effect.Effect<
    {
      positionSize: number;
      kellyFraction: number;
      safeKellyFraction: number;
      maxLoss: number;
      riskAmount: number;
    },
    TradingError
  > => {
    return Effect.gen(function* () {
      if (winRate < 0 || winRate > 1) {
        throw new TradingError({
          message: `Win rate must be between 0 and 1, got ${winRate}`,
          code: "INVALID_WIN_RATE",
          timestamp: new Date(),
        });
      }

      if (riskRewardRatio <= 0) {
        throw new TradingError({
          message: `Risk/reward ratio must be positive, got ${riskRewardRatio}`,
          code: "INVALID_RISK_REWARD_RATIO",
          timestamp: new Date(),
        });
      }

      if (accountBalance <= 0) {
        throw new TradingError({
          message: `Account balance must be positive, got ${accountBalance}`,
          code: "INVALID_ACCOUNT_BALANCE",
          timestamp: new Date(),
        });
      }

      // Kelly Criterion: (winRate * riskRewardRatio - (1 - winRate)) / riskRewardRatio
      const kellyFraction =
        (winRate * riskRewardRatio - (1 - winRate)) / riskRewardRatio;

      // Use 25% of full Kelly for safety (fractional Kelly)
      const safeKelly = Math.max(0, kellyFraction * 0.25);

      // Calculate risk amount
      const riskAmount = accountBalance * safeKelly;

      // Calculate position size based on stop loss distance
      const priceRisk = Math.abs(entryPrice - stopLoss);
      if (priceRisk === 0) {
        throw new TradingError({
          message: "Entry price and stop loss cannot be the same",
          code: "INVALID_STOP_LOSS",
          timestamp: new Date(),
        });
      }

      const positionSize = Math.floor(riskAmount / priceRisk);

      return {
        positionSize,
        kellyFraction,
        safeKellyFraction: safeKelly,
        maxLoss: riskAmount,
        riskAmount,
      };
    });
  };

  /**
   * Calculate position size with fixed percentage of portfolio
   * @param accountBalance - Current account balance
   * @param percentage - Percentage of portfolio to risk (0-1)
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @returns Position size
   */
  calculateFixedPercentagePosition = (
    accountBalance: number,
    percentage: number,
    entryPrice: number,
    stopLoss: number
  ): Effect.Effect<number, TradingError> =>
    Effect.gen(function* () {
      if (percentage <= 0 || percentage > 1) {
        throw new TradingError({
          message: `Percentage must be between 0 and 1, got ${percentage}`,
          code: "INVALID_PERCENTAGE",
          timestamp: new Date(),
        });
      }

      const riskAmount = accountBalance * percentage;
      const priceRisk = Math.abs(entryPrice - stopLoss);

      if (priceRisk === 0) {
        throw new TradingError({
          message: "Entry price and stop loss cannot be the same",
          code: "INVALID_STOP_LOSS",
          timestamp: new Date(),
        });
      }

      return Math.floor(riskAmount / priceRisk);
    });
}

// Export singleton instance
export const positionSizer = new PositionSizer();
