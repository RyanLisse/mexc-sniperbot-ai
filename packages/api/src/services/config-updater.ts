import type { TradingConfiguration } from "@mexc-sniperbot-ai/db";
import { Effect } from "effect";
import { TradingLogger } from "../lib/effect";
import { configService } from "./config-service";
import type { TradingConfigurationInput } from "./config-validator";
import { configValidator } from "./config-validator";
import { websocketService } from "./websocket-service";

export const configUpdater = {
  updateConfiguration(
    userId: string,
    configId: string,
    updates: Partial<TradingConfigurationInput>
  ): Effect.Effect<TradingConfiguration, Error> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo(
        "Updating configuration with real-time sync",
        {
          userId,
          configId,
          updates,
        }
      );

      // Get existing configuration for validation
      const existingConfig =
        yield* configService.getActiveConfiguration(userId);

      if (!existingConfig) {
        throw new Error("No active configuration found");
      }

      // Convert existing config to input format for validation
      const existingInput: TradingConfigurationInput = {
        enabledPairs: Array.isArray(existingConfig.enabledPairs)
          ? existingConfig.enabledPairs
          : [],
        maxPurchaseAmount: existingConfig.maxPurchaseAmount,
        priceTolerance: existingConfig.priceTolerance / 100, // Convert from basis points
        dailySpendingLimit: existingConfig.dailySpendingLimit,
        maxTradesPerHour: existingConfig.maxTradesPerHour,
        pollingInterval: existingConfig.pollingInterval,
        orderTimeout: existingConfig.orderTimeout,
        isActive: existingConfig.isActive,
      };

      // Validate partial updates
      const validatedUpdates =
        yield* configValidator.validatePartialConfiguration(
          updates,
          existingInput
        );

      // Update configuration
      const updatedConfig = yield* configService.updateConfiguration(
        configId,
        userId,
        validatedUpdates
      );

      // Broadcast update via WebSocket
      websocketService.broadcast({
        type: "configuration",
        payload: {
          action: "updated",
          config: updatedConfig,
          timestamp: new Date().toISOString(),
        },
      });

      yield* TradingLogger.logInfo("Configuration updated and broadcast", {
        configId: updatedConfig.id,
      });

      return updatedConfig;
    });
  },

  activateConfiguration(
    userId: string,
    configId: string
  ): Effect.Effect<TradingConfiguration, Error> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Activating configuration", {
        userId,
        configId,
      });

      // Deactivate all other configurations
      const allConfigs = yield* configService.getAllConfigurations(userId);
      for (const config of allConfigs) {
        if (config.id !== configId && config.isActive) {
          yield* configService.updateConfiguration(config.id, userId, {
            isActive: false,
          });
        }
      }

      // Activate target configuration
      const activatedConfig = yield* configService.updateConfiguration(
        configId,
        userId,
        {
          isActive: true,
        }
      );

      // Broadcast activation
      websocketService.broadcast({
        type: "configuration",
        payload: {
          action: "activated",
          config: activatedConfig,
          timestamp: new Date().toISOString(),
        },
      });

      yield* TradingLogger.logInfo("Configuration activated", {
        configId: activatedConfig.id,
      });

      return activatedConfig;
    });
  },

  deactivateConfiguration(
    userId: string,
    configId: string
  ): Effect.Effect<TradingConfiguration, Error> {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Deactivating configuration", {
        userId,
        configId,
      });

      const deactivatedConfig = yield* configService.updateConfiguration(
        configId,
        userId,
        {
          isActive: false,
        }
      );

      // Broadcast deactivation
      websocketService.broadcast({
        type: "configuration",
        payload: {
          action: "deactivated",
          config: deactivatedConfig,
          timestamp: new Date().toISOString(),
        },
      });

      yield* TradingLogger.logInfo("Configuration deactivated", {
        configId: deactivatedConfig.id,
      });

      return deactivatedConfig;
    });
  },
};
