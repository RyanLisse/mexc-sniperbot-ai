import type { TradingConfiguration } from "@mexc-sniperbot-ai/db";
import { db, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { ConfigurationError, TradingLogger } from "../lib/effect";
import type { TradingConfigurationInput } from "./config-validator";

export const configService = {
  getActiveConfiguration(
    userId: string
  ): Effect.Effect<TradingConfiguration | null, ConfigurationError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Fetching active configuration", {
        userId,
      });

      const configs = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradingConfiguration)
            .where(eq(tradingConfiguration.userId, userId))
            .orderBy(desc(tradingConfiguration.updatedAt))
            .limit(1),
        catch: (error) =>
          new ConfigurationError({
            message: `Failed to fetch configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            field: "database",
            timestamp: new Date(),
          }),
      });

      return configs.at(0) ?? null;
    });
  },

  getAllConfigurations(
    userId: string
  ): Effect.Effect<TradingConfiguration[], ConfigurationError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logDebug("Fetching all configurations", { userId });

      const configs = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(tradingConfiguration)
            .where(eq(tradingConfiguration.userId, userId))
            .orderBy(desc(tradingConfiguration.updatedAt)),
        catch: (error) =>
          new ConfigurationError({
            message: `Failed to fetch configurations: ${error instanceof Error ? error.message : "Unknown error"}`,
            field: "database",
            timestamp: new Date(),
          }),
      });

      return configs;
    });
  },

  createConfiguration(
    userId: string,
    config: TradingConfigurationInput
  ): Effect.Effect<TradingConfiguration, ConfigurationError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Creating new configuration", {
        userId,
        config,
      });

      // Deactivate all existing configurations
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(tradingConfiguration)
            .set({ isActive: false })
            .where(eq(tradingConfiguration.userId, userId)),
        catch: (error) =>
          new ConfigurationError({
            message: `Failed to deactivate existing configurations: ${error instanceof Error ? error.message : "Unknown error"}`,
            field: "database",
            timestamp: new Date(),
          }),
      });

      // Create new configuration
      const [newConfig] = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(tradingConfiguration)
            .values({
              userId,
              enabledPairs: config.enabledPairs,
              maxPurchaseAmount: config.maxPurchaseAmount,
              priceTolerance: Math.round(config.priceTolerance * 100), // Convert to basis points
              dailySpendingLimit: config.dailySpendingLimit,
              maxTradesPerHour: config.maxTradesPerHour,
              pollingInterval: config.pollingInterval,
              orderTimeout: config.orderTimeout,
              isActive: config.isActive,
            })
            .returning(),
        catch: (error) =>
          new ConfigurationError({
            message: `Failed to create configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            field: "database",
            timestamp: new Date(),
          }),
      });

      yield* TradingLogger.logInfo("Configuration created successfully", {
        configId: newConfig.id,
      });

      return newConfig;
    });
  },

  updateConfiguration(
    configId: string,
    userId: string,
    updates: Partial<TradingConfigurationInput>
  ): Effect.Effect<TradingConfiguration, ConfigurationError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Updating configuration", {
        configId,
        userId,
        updates,
      });

      const updateData: Partial<typeof tradingConfiguration.$inferInsert> = {};

      if (updates.enabledPairs !== undefined) {
        updateData.enabledPairs = updates.enabledPairs;
      }
      if (updates.maxPurchaseAmount !== undefined) {
        updateData.maxPurchaseAmount = updates.maxPurchaseAmount;
      }
      if (updates.priceTolerance !== undefined) {
        updateData.priceTolerance = Math.round(updates.priceTolerance * 100); // Convert to basis points
      }
      if (updates.dailySpendingLimit !== undefined) {
        updateData.dailySpendingLimit = updates.dailySpendingLimit;
      }
      if (updates.maxTradesPerHour !== undefined) {
        updateData.maxTradesPerHour = updates.maxTradesPerHour;
      }
      if (updates.pollingInterval !== undefined) {
        updateData.pollingInterval = updates.pollingInterval;
      }
      if (updates.orderTimeout !== undefined) {
        updateData.orderTimeout = updates.orderTimeout;
      }
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive;
      }

      updateData.updatedAt = new Date();

      const [updatedConfig] = yield* Effect.tryPromise({
        try: () =>
          db
            .update(tradingConfiguration)
            .set(updateData)
            .where(eq(tradingConfiguration.id, configId))
            .returning(),
        catch: (error) =>
          new ConfigurationError({
            message: `Failed to update configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
            field: "database",
            timestamp: new Date(),
          }),
      });

      yield* TradingLogger.logInfo("Configuration updated successfully", {
        configId: updatedConfig.id,
      });

      return updatedConfig;
    });
  },

  resetToDefaults(
    userId: string
  ): Effect.Effect<TradingConfiguration, ConfigurationError> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Resetting configuration to defaults", {
        userId,
      });

      const defaultConfig: TradingConfigurationInput = {
        enabledPairs: ["BTC/USDT", "ETH/USDT"],
        maxPurchaseAmount: 100,
        priceTolerance: 1.0, // 1%
        dailySpendingLimit: 1000,
        maxTradesPerHour: 10,
        pollingInterval: 5000, // 5 seconds
        orderTimeout: 10_000, // 10 seconds
        isActive: false, // Start inactive for safety
      };

      return yield* this.createConfiguration(userId, defaultConfig);
    });
  },
};
