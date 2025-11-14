import { z } from "zod";

/**
 * Zod schemas for bot configuration API requests and responses
 * Used for validation in Encore endpoints
 */

/**
 * Create configuration request schema
 */
export const CreateConfigurationRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  symbols: z
    .array(z.string().regex(/^[A-Z0-9]+USDT$/, "Invalid trading pair format"))
    .min(1, "At least one symbol required")
    .max(50, "Too many symbols"),
  quoteAmount: z
    .number()
    .positive("Quote amount must be positive")
    .max(100_000, "Quote amount too large"),
  maxTradesPerHour: z
    .number()
    .int("Must be an integer")
    .positive("Must be positive")
    .max(100, "Max trades per hour cannot exceed 100"),
  maxDailySpend: z
    .number()
    .positive("Daily spend must be positive")
    .max(1_000_000, "Daily spend limit too large"),
  recvWindow: z
    .number()
    .int("Must be an integer")
    .positive("Must be positive")
    .max(1000, "recvWindow cannot exceed 1000ms"),
  safetyEnabled: z.boolean().default(true),
});

export type CreateConfigurationRequest = z.infer<
  typeof CreateConfigurationRequestSchema
>;

/**
 * Update configuration request schema
 */
export const UpdateConfigurationRequestSchema =
  CreateConfigurationRequestSchema.partial();

export type UpdateConfigurationRequest = z.infer<
  typeof UpdateConfigurationRequestSchema
>;

/**
 * Configuration response schema
 */
export const ConfigurationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  symbols: z.array(z.string()),
  quoteAmount: z.number(),
  maxTradesPerHour: z.number(),
  maxDailySpend: z.number(),
  recvWindow: z.number(),
  safetyEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().optional(),
});

export type ConfigurationResponse = z.infer<typeof ConfigurationResponseSchema>;

/**
 * List configurations request schema (query params)
 */
export const ListConfigurationsRequestSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  createdBy: z.string().optional(),
});

export type ListConfigurationsRequest = z.infer<
  typeof ListConfigurationsRequestSchema
>;

/**
 * List configurations response schema
 */
export const ListConfigurationsResponseSchema = z.object({
  configurations: z.array(ConfigurationResponseSchema),
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListConfigurationsResponse = z.infer<
  typeof ListConfigurationsResponseSchema
>;

/**
 * Get configuration by ID request schema
 */
export const GetConfigurationRequestSchema = z.object({
  id: z.string().uuid("Invalid configuration ID format"),
});

export type GetConfigurationRequest = z.infer<
  typeof GetConfigurationRequestSchema
>;

/**
 * Delete configuration request schema
 */
export const DeleteConfigurationRequestSchema = z.object({
  id: z.string().uuid("Invalid configuration ID format"),
});

export type DeleteConfigurationRequest = z.infer<
  typeof DeleteConfigurationRequestSchema
>;

/**
 * Configuration validation error schema
 */
export const ConfigurationValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
});

export type ConfigurationValidationError = z.infer<
  typeof ConfigurationValidationErrorSchema
>;

/**
 * Configuration error response schema
 */
export const ConfigurationErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.array(ConfigurationValidationErrorSchema).optional(),
});

export type ConfigurationErrorResponse = z.infer<
  typeof ConfigurationErrorResponseSchema
>;

/**
 * Regex pattern for valid MEXC trading pairs
 */
const SYMBOL_PATTERN = /^[A-Z0-9]+USDT$/;

/**
 * Validate configuration symbols
 */
export function validateSymbols(symbols: string[]): boolean {
  return symbols.every((symbol) => SYMBOL_PATTERN.test(symbol));
}

/**
 * Validate configuration constraints
 */
export function validateConfiguration(
  config: CreateConfigurationRequest
): ConfigurationValidationError[] {
  const errors: ConfigurationValidationError[] = [];

  // Validate quote amount vs daily spend
  if (config.quoteAmount * config.maxTradesPerHour > config.maxDailySpend) {
    errors.push({
      field: "maxDailySpend",
      message:
        "Daily spend must be >= quoteAmount * maxTradesPerHour to allow configured trading",
      code: "INSUFFICIENT_DAILY_SPEND",
    });
  }

  // Validate recvWindow
  if (config.recvWindow > 1000) {
    errors.push({
      field: "recvWindow",
      message: "recvWindow must not exceed 1000ms for MEXC compatibility",
      code: "INVALID_RECV_WINDOW",
    });
  }

  // Validate symbols format
  if (!validateSymbols(config.symbols)) {
    errors.push({
      field: "symbols",
      message: "All symbols must be valid MEXC trading pairs (e.g., BTCUSDT)",
      code: "INVALID_SYMBOL_FORMAT",
    });
  }

  return errors;
}
