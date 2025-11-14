import { Effect } from "effect";
import { ConfigurationError } from "../lib/effect";

export type TradingConfigurationInput = {
  enabledPairs: string[];
  maxPurchaseAmount: number;
  priceTolerance: number; // percentage (0-100)
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval: number; // milliseconds
  orderTimeout: number; // milliseconds
  profitTargetPercent?: number; // basis points (500 = 5%)
  stopLossPercent?: number; // basis points (200 = 2%)
  timeBasedExitMinutes?: number; // minutes
  trailingStopPercent?: number; // basis points (optional)
  sellStrategy?: string; // "PROFIT_TARGET", "STOP_LOSS", "TIME_BASED", "TRAILING_STOP", "COMBINED"
  isActive: boolean;
};

const MIN_PRICE_TOLERANCE = 0.1;
const MAX_PRICE_TOLERANCE = 50;
const MIN_POLLING_INTERVAL = 1000; // 1 second
const MIN_ORDER_TIMEOUT = 5000; // 5 seconds

const validatePriceTolerance = (
  value: number
): Effect.Effect<number, ConfigurationError> => {
  if (value < MIN_PRICE_TOLERANCE || value > MAX_PRICE_TOLERANCE) {
    return Effect.fail(
      new ConfigurationError({
        message: `Price tolerance must be between ${MIN_PRICE_TOLERANCE}% and ${MAX_PRICE_TOLERANCE}%`,
        field: "priceTolerance",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateMaxPurchaseAmount = (
  maxPurchaseAmount: number,
  dailySpendingLimit: number
): Effect.Effect<number, ConfigurationError> => {
  if (maxPurchaseAmount <= 0) {
    return Effect.fail(
      new ConfigurationError({
        message: "Max purchase amount must be greater than 0",
        field: "maxPurchaseAmount",
        timestamp: new Date(),
      })
    );
  }

  if (maxPurchaseAmount > dailySpendingLimit) {
    return Effect.fail(
      new ConfigurationError({
        message: "Max purchase amount cannot exceed daily spending limit",
        field: "maxPurchaseAmount",
        timestamp: new Date(),
      })
    );
  }

  return Effect.succeed(maxPurchaseAmount);
};

const validateDailySpendingLimit = (
  value: number
): Effect.Effect<number, ConfigurationError> => {
  if (value <= 0) {
    return Effect.fail(
      new ConfigurationError({
        message: "Daily spending limit must be greater than 0",
        field: "dailySpendingLimit",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validatePollingInterval = (
  value: number
): Effect.Effect<number, ConfigurationError> => {
  if (value < MIN_POLLING_INTERVAL) {
    return Effect.fail(
      new ConfigurationError({
        message: `Polling interval must be at least ${MIN_POLLING_INTERVAL}ms to respect rate limits`,
        field: "pollingInterval",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateOrderTimeout = (
  value: number
): Effect.Effect<number, ConfigurationError> => {
  if (value < MIN_ORDER_TIMEOUT) {
    return Effect.fail(
      new ConfigurationError({
        message: `Order timeout must be at least ${MIN_ORDER_TIMEOUT}ms`,
        field: "orderTimeout",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateEnabledPairs = (
  pairs: string[]
): Effect.Effect<string[], ConfigurationError> => {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return Effect.fail(
      new ConfigurationError({
        message: "At least one enabled pair is required",
        field: "enabledPairs",
        timestamp: new Date(),
      })
    );
  }

  // Validate pair format (e.g., "BTC/USDT" or "BTCUSDT")
  const invalidPairs = pairs.filter(
    (pair) => !/^[A-Z0-9]+(\/)?[A-Z0-9]+$/.test(pair.toUpperCase())
  );

  if (invalidPairs.length > 0) {
    return Effect.fail(
      new ConfigurationError({
        message: `Invalid pair format: ${invalidPairs.join(", ")}`,
        field: "enabledPairs",
        timestamp: new Date(),
      })
    );
  }

  return Effect.succeed(pairs.map((p) => p.toUpperCase()));
};

const validateMaxTradesPerHour = (
  value: number
): Effect.Effect<number, ConfigurationError> => {
  if (value <= 0) {
    return Effect.fail(
      new ConfigurationError({
        message: "Max trades per hour must be greater than 0",
        field: "maxTradesPerHour",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateProfitTargetPercent = (
  value?: number
): Effect.Effect<number | undefined, ConfigurationError> => {
  if (value === undefined) {
    return Effect.succeed(undefined);
  }
  if (value <= 0 || value >= 10_000) {
    return Effect.fail(
      new ConfigurationError({
        message:
          "Profit target percent must be between 1 and 9999 basis points (0.01% to 99.99%)",
        field: "profitTargetPercent",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateStopLossPercent = (
  value?: number
): Effect.Effect<number | undefined, ConfigurationError> => {
  if (value === undefined) {
    return Effect.succeed(undefined);
  }
  if (value <= 0 || value >= 10_000) {
    return Effect.fail(
      new ConfigurationError({
        message:
          "Stop loss percent must be between 1 and 9999 basis points (0.01% to 99.99%)",
        field: "stopLossPercent",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateTimeBasedExitMinutes = (
  value?: number
): Effect.Effect<number | undefined, ConfigurationError> => {
  if (value === undefined) {
    return Effect.succeed(undefined);
  }
  if (value <= 0) {
    return Effect.fail(
      new ConfigurationError({
        message: "Time-based exit minutes must be greater than 0",
        field: "timeBasedExitMinutes",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const validateTrailingStopPercent = (
  value?: number
): Effect.Effect<number | undefined, ConfigurationError> => {
  if (value === undefined) {
    return Effect.succeed(undefined);
  }
  if (value <= 0 || value >= 10_000) {
    return Effect.fail(
      new ConfigurationError({
        message:
          "Trailing stop percent must be between 1 and 9999 basis points (0.01% to 99.99%)",
        field: "trailingStopPercent",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

const VALID_SELL_STRATEGIES = [
  "PROFIT_TARGET",
  "STOP_LOSS",
  "TIME_BASED",
  "TRAILING_STOP",
  "COMBINED",
] as const;

const validateSellStrategy = (
  value?: string
): Effect.Effect<string | undefined, ConfigurationError> => {
  if (value === undefined) {
    return Effect.succeed(undefined);
  }
  if (
    !VALID_SELL_STRATEGIES.includes(
      value as (typeof VALID_SELL_STRATEGIES)[number]
    )
  ) {
    return Effect.fail(
      new ConfigurationError({
        message: `Sell strategy must be one of: ${VALID_SELL_STRATEGIES.join(", ")}`,
        field: "sellStrategy",
        timestamp: new Date(),
      })
    );
  }
  return Effect.succeed(value);
};

export const configValidator = {
  validateConfiguration(
    config: TradingConfigurationInput
  ): Effect.Effect<TradingConfigurationInput, ConfigurationError> {
    return Effect.gen(function* () {
      // Validate all fields
      const enabledPairs = yield* validateEnabledPairs(config.enabledPairs);
      const maxPurchaseAmount = yield* validateMaxPurchaseAmount(
        config.maxPurchaseAmount,
        config.dailySpendingLimit
      );
      const priceTolerance = yield* validatePriceTolerance(
        config.priceTolerance
      );
      const dailySpendingLimit = yield* validateDailySpendingLimit(
        config.dailySpendingLimit
      );
      const maxTradesPerHour = yield* validateMaxTradesPerHour(
        config.maxTradesPerHour
      );
      const pollingInterval = yield* validatePollingInterval(
        config.pollingInterval
      );
      const orderTimeout = yield* validateOrderTimeout(config.orderTimeout);
      const profitTargetPercent = yield* validateProfitTargetPercent(
        config.profitTargetPercent
      );
      const stopLossPercent = yield* validateStopLossPercent(
        config.stopLossPercent
      );
      const timeBasedExitMinutes = yield* validateTimeBasedExitMinutes(
        config.timeBasedExitMinutes
      );
      const trailingStopPercent = yield* validateTrailingStopPercent(
        config.trailingStopPercent
      );
      const sellStrategy = yield* validateSellStrategy(config.sellStrategy);

      return {
        ...config,
        enabledPairs,
        maxPurchaseAmount,
        priceTolerance,
        dailySpendingLimit,
        maxTradesPerHour,
        pollingInterval,
        orderTimeout,
        profitTargetPercent,
        stopLossPercent,
        timeBasedExitMinutes,
        trailingStopPercent,
        sellStrategy,
      };
    });
  },

  validatePartialConfiguration(
    config: Partial<TradingConfigurationInput>,
    existingConfig: TradingConfigurationInput
  ): Effect.Effect<Partial<TradingConfigurationInput>, ConfigurationError> {
    const merged = { ...existingConfig, ...config };

    return this.validateConfiguration(merged).pipe(
      Effect.map((validated) => {
        // Return only the fields that were provided
        const result: Partial<TradingConfigurationInput> = {};
        if (config.enabledPairs !== undefined) {
          result.enabledPairs = validated.enabledPairs;
        }
        if (config.maxPurchaseAmount !== undefined) {
          result.maxPurchaseAmount = validated.maxPurchaseAmount;
        }
        if (config.priceTolerance !== undefined) {
          result.priceTolerance = validated.priceTolerance;
        }
        if (config.dailySpendingLimit !== undefined) {
          result.dailySpendingLimit = validated.dailySpendingLimit;
        }
        if (config.maxTradesPerHour !== undefined) {
          result.maxTradesPerHour = validated.maxTradesPerHour;
        }
        if (config.pollingInterval !== undefined) {
          result.pollingInterval = validated.pollingInterval;
        }
        if (config.orderTimeout !== undefined) {
          result.orderTimeout = validated.orderTimeout;
        }
        if (config.isActive !== undefined) {
          result.isActive = validated.isActive;
        }
        if (config.profitTargetPercent !== undefined) {
          result.profitTargetPercent = validated.profitTargetPercent;
        }
        if (config.stopLossPercent !== undefined) {
          result.stopLossPercent = validated.stopLossPercent;
        }
        if (config.timeBasedExitMinutes !== undefined) {
          result.timeBasedExitMinutes = validated.timeBasedExitMinutes;
        }
        if (config.trailingStopPercent !== undefined) {
          result.trailingStopPercent = validated.trailingStopPercent;
        }
        if (config.sellStrategy !== undefined) {
          result.sellStrategy = validated.sellStrategy;
        }
        return result;
      })
    );
  },
};
