import { router, protectedProcedure, publicProcedure } from "../index";
import { Effect } from "effect";
import { z } from "zod";
import { db } from "@mexc-sniperbot-ai/db";
import { eq, and, desc } from "drizzle-orm";
import { tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { ConfigurationError, TradingLogger } from "../lib/effect";
import type { TradingConfiguration as TradingConfigType } from "@mexc-sniperbot-ai/db";

// Zod schemas for validation
const tradingConfigurationSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  enabledPairs: z.array(z.string()).min(1, "At least one enabled pair is required"),
  maxPurchaseAmount: z.number().positive("Max purchase amount must be positive"),
  priceTolerance: z.number().min(0, "Price tolerance must be non-negative").max(100, "Price tolerance cannot exceed 100%"),
  dailySpendingLimit: z.number().positive("Daily spending limit must be positive"),
  maxTradesPerHour: z.number().positive("Max trades per hour must be positive"),
  pollingInterval: z.number().positive("Polling interval must be positive"),
  orderTimeout: z.number().positive("Order timeout must be positive"),
  isActive: z.boolean(),
});

const updateConfigurationSchema = tradingConfigurationSchema.partial().extend({
  id: z.string().min(1, "ID is required"),
});

const configurationQuerySchema = z.object({
  symbol: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().nonnegative().default(0),
});

// Configuration router
export const configurationRouter = router({
  // Get all trading configurations
  getConfigurations: protectedProcedure
    .input(configurationQuerySchema)
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching trading configurations", input);

          const configurations = yield* Effect.tryPromise({
            try: () => {
              let query = db.select().from(tradingConfiguration);
              
              // Apply filters
              if (input.symbol) {
                query = query.where(eq(tradingConfiguration.symbol, input.symbol));
              }
              if (input.isActive !== undefined) {
                query = query.where(eq(tradingConfiguration.isActive, input.isActive));
              }
              
              return query
                .orderBy(desc(tradingConfiguration.updatedAt))
                .limit(input.limit)
                .offset(input.offset);
            },
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configurations: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          yield* TradingLogger.logInfo(`Fetched ${configurations.length} configurations`);

          return configurations.map(config => ({
            ...config,
            enabledPairs: Array.isArray(config.enabledPairs) ? config.enabledPairs : [],
          }));
        })
      );
    }),

  // Get configuration by ID
  getConfigurationById: protectedProcedure
    .input(z.object({ id: z.string().min(1, "ID is required") }))
    .query(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching configuration by ID", { id: input.id });

          const configurations = yield* Effect.tryPromise({
            try: () => db.select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.id, input.id))
              .limit(1),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          if (configurations.length === 0) {
            throw new ConfigurationError({
              message: `Configuration with ID ${input.id} not found`,
              field: "id",
              timestamp: new Date(),
            });
          }

          const config = configurations[0];
          
          yield* TradingLogger.logInfo("Configuration fetched successfully", { 
            id: config.id, 
            symbol: config.symbol 
          });

          return {
            ...config,
            enabledPairs: Array.isArray(config.enabledPairs) ? config.enabledPairs : [],
          };
        })
      );
    }),

  // Create new trading configuration
  createConfiguration: protectedProcedure
    .input(tradingConfigurationSchema)
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Creating new trading configuration", input);

          // Check if configuration for this symbol already exists
          const existingConfigs = yield* Effect.tryPromise({
            try: () => db.select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.symbol, input.symbol))
              .limit(1),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to check existing configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          if (existingConfigs.length > 0) {
            throw new ConfigurationError({
              message: `Configuration for symbol ${input.symbol} already exists`,
              field: "symbol",
              timestamp: new Date(),
            });
          }

          // Validate configuration values
          yield* validateConfigurationValues(input);

          // Create new configuration
          const newConfig = yield* Effect.tryPromise({
            try: () => db.insert(tradingConfiguration).values({
              id: `config_${input.symbol}_${Date.now()}`,
              ...input,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning(),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to create configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          const createdConfig = newConfig[0];

          yield* TradingLogger.logInfo("Configuration created successfully", {
            id: createdConfig.id,
            symbol: createdConfig.symbol,
          });

          return {
            ...createdConfig,
            enabledPairs: Array.isArray(createdConfig.enabledPairs) ? createdConfig.enabledPairs : [],
          };
        })
      );
    }),

  // Update existing configuration
  updateConfiguration: protectedProcedure
    .input(updateConfigurationSchema)
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          const { id, ...updateData } = input;
          
          yield* TradingLogger.logInfo("Updating trading configuration", { id, updateData });

          // Check if configuration exists
          const existingConfigs = yield* Effect.tryPromise({
            try: () => db.select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.id, id))
              .limit(1),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configuration for update: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          if (existingConfigs.length === 0) {
            throw new ConfigurationError({
              message: `Configuration with ID ${id} not found`,
              field: "id",
              timestamp: new Date(),
            });
          }

          // Validate update data
          if (Object.keys(updateData).length > 0) {
            yield* validateConfigurationValues({
              ...existingConfigs[0],
              ...updateData,
              enabledPairs: updateData.enabledPairs ?? existingConfigs[0].enabledPairs,
            });
          }

          // Update configuration
          const updatedConfigs = yield* Effect.tryPromise({
            try: () => db.update(tradingConfiguration)
              .set({
                ...updateData,
                updatedAt: new Date(),
              })
              .where(eq(tradingConfiguration.id, id))
              .returning(),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to update configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          const updatedConfig = updatedConfigs[0];

          yield* TradingLogger.logInfo("Configuration updated successfully", {
            id: updatedConfig.id,
            symbol: updatedConfig.symbol,
          });

          return {
            ...updatedConfig,
            enabledPairs: Array.isArray(updatedConfig.enabledPairs) ? updatedConfig.enabledPairs : [],
          };
        })
      );
    }),

  // Delete configuration
  deleteConfiguration: protectedProcedure
    .input(z.object({ id: z.string().min(1, "ID is required") }))
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Deleting trading configuration", { id: input.id });

          // Check if configuration exists
          const existingConfigs = yield* Effect.tryPromise({
            try: () => db.select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.id, input.id))
              .limit(1),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configuration for deletion: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          if (existingConfigs.length === 0) {
            throw new ConfigurationError({
              message: `Configuration with ID ${input.id} not found`,
              field: "id",
              timestamp: new Date(),
            });
          }

          // Delete configuration
          yield* Effect.tryPromise({
            try: () => db.delete(tradingConfiguration)
              .where(eq(tradingConfiguration.id, input.id)),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to delete configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          yield* TradingLogger.logInfo("Configuration deleted successfully", {
            id: input.id,
            symbol: existingConfigs[0].symbol,
          });

          return { success: true, deletedId: input.id };
        })
      );
    }),

  // Activate/deactivate configuration
  toggleConfiguration: protectedProcedure
    .input(z.object({ 
      id: z.string().min(1, "ID is required"),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Toggling configuration status", input);

          // Check if configuration exists
          const existingConfigs = yield* Effect.tryPromise({
            try: () => db.select()
              .from(tradingConfiguration)
              .where(eq(tradingConfiguration.id, input.id))
              .limit(1),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configuration for toggle: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          if (existingConfigs.length === 0) {
            throw new ConfigurationError({
              message: `Configuration with ID ${input.id} not found`,
              field: "id",
              timestamp: new Date(),
            });
          }

          // Update configuration status
          const updatedConfigs = yield* Effect.tryPromise({
            try: () => db.update(tradingConfiguration)
              .set({
                isActive: input.isActive,
                updatedAt: new Date(),
              })
              .where(eq(tradingConfiguration.id, input.id))
              .returning(),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to toggle configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          const updatedConfig = updatedConfigs[0];

          yield* TradingLogger.logInfo("Configuration status toggled successfully", {
            id: updatedConfig.id,
            symbol: updatedConfig.symbol,
            isActive: updatedConfig.isActive,
          });

          return {
            ...updatedConfig,
            enabledPairs: Array.isArray(updatedConfig.enabledPairs) ? updatedConfig.enabledPairs : [],
          };
        })
      );
    }),

  // Get configuration statistics
  getConfigurationStats: protectedProcedure
    .query(async () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          yield* TradingLogger.logInfo("Fetching configuration statistics");

          const allConfigs = yield* Effect.tryPromise({
            try: () => db.select().from(tradingConfiguration),
            catch: (error) => {
              throw new ConfigurationError({
                message: `Failed to fetch configurations for statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
                field: "database",
                timestamp: new Date(),
              });
            },
          });

          const activeConfigs = allConfigs.filter(config => config.isActive);
          const inactiveConfigs = allConfigs.filter(config => !config.isActive);

          const stats = {
            total: allConfigs.length,
            active: activeConfigs.length,
            inactive: inactiveConfigs.length,
            totalDailyLimit: allConfigs.reduce((sum, config) => sum + config.dailySpendingLimit, 0),
            activeDailyLimit: activeConfigs.reduce((sum, config) => sum + config.dailySpendingLimit, 0),
            averageMaxPurchaseAmount: allConfigs.length > 0 
              ? allConfigs.reduce((sum, config) => sum + config.maxPurchaseAmount, 0) / allConfigs.length 
              : 0,
            averageMaxTradesPerHour: allConfigs.length > 0
              ? allConfigs.reduce((sum, config) => sum + config.maxTradesPerHour, 0) / allConfigs.length
              : 0,
          };

          yield* TradingLogger.logInfo("Configuration statistics fetched", stats);

          return stats;
        })
      );
    }),
});

// Helper function to validate configuration values
const validateConfigurationValues = (config: Partial<TradingConfigType>): Effect.Effect<void, ConfigurationError> => {
  return Effect.sync(() => {
    // Validate daily spending limit vs max purchase amount
    if (config.maxPurchaseAmount && config.dailySpendingLimit) {
      if (config.maxPurchaseAmount > config.dailySpendingLimit) {
        throw new ConfigurationError({
          message: "Max purchase amount cannot exceed daily spending limit",
          field: "maxPurchaseAmount",
          timestamp: new Date(),
        });
      }
    }

    // Validate polling interval (should be reasonable)
    if (config.pollingInterval && config.pollingInterval < 1_000) {
      throw new ConfigurationError({
        message: "Polling interval must be at least 1000ms (1 second)",
        field: "pollingInterval",
        timestamp: new Date(),
      });
    }

    if (config.pollingInterval && config.pollingInterval > 300_000) {
      throw new ConfigurationError({
        message: "Polling interval cannot exceed 300000ms (5 minutes)",
        field: "pollingInterval",
        timestamp: new Date(),
      });
    }

    // Validate order timeout
    if (config.orderTimeout && config.orderTimeout < 5_000) {
      throw new ConfigurationError({
        message: "Order timeout must be at least 5000ms (5 seconds)",
        field: "orderTimeout",
        timestamp: new Date(),
      });
    }

    if (config.orderTimeout && config.orderTimeout > 300_000) {
      throw new ConfigurationError({
        message: "Order timeout cannot exceed 300000ms (5 minutes)",
        field: "orderTimeout",
        timestamp: new Date(),
      });
    }

    // Validate max trades per hour
    if (config.maxTradesPerHour && config.maxTradesPerHour > 100) {
      throw new ConfigurationError({
        message: "Max trades per hour cannot exceed 100",
        field: "maxTradesPerHour",
        timestamp: new Date(),
      });
    }
  });
};
