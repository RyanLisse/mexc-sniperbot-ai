import {
  db,
  type NewTradingConfiguration,
  type TradingConfiguration,
  tradingConfiguration,
} from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { api } from "encore.dev/api";

// Canonical configuration shape used by the frontend and OpenAPI contract
type Configuration = {
  id: string;
  name: string;
  symbols: string[];
  quoteAmount: number;
  maxTradesPerHour: number;
  maxDailySpend: number;
  recvWindow: number;
  safetyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

type CreateConfigurationRequest = {
  name: string;
  symbols: string[];
  quoteAmount: number;
  maxTradesPerHour: number;
  maxDailySpend: number;
  recvWindow: number;
  safetyEnabled: boolean;
};

type ListConfigurationsRequest = {
  limit?: number;
  offset?: number;
};

type ListConfigurationsResponse = {
  configurations: Configuration[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type GetConfigurationRequest = {
  id: string;
};

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

const SYMBOL_PATTERN = /^[A-Z0-9]+USDT$/;

function validateCreateConfiguration(req: CreateConfigurationRequest): void {
  const errors: string[] = [];

  if (req.quoteAmount <= 0) {
    errors.push("quoteAmount must be greater than 0");
  }

  if (req.maxTradesPerHour <= 0 || req.maxTradesPerHour > 100) {
    errors.push("maxTradesPerHour must be between 1 and 100");
  }

  if (req.maxDailySpend < 0) {
    errors.push("maxDailySpend cannot be negative");
  }

  if (req.recvWindow <= 0 || req.recvWindow > 1000) {
    errors.push("recvWindow must be between 1 and 1000ms");
  }

  if (req.symbols.length === 0) {
    errors.push("At least one symbol is required");
  }

  for (const symbol of req.symbols) {
    if (!SYMBOL_PATTERN.test(symbol)) {
      errors.push(`Invalid symbol format: ${symbol} (must be like BTCUSDT)`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(", ")}`);
  }
}

function mapToConfiguration(row: TradingConfiguration): Configuration {
  return {
    id: row.id,
    name: `Configuration ${row.id.slice(0, 8)}`,
    symbols: Array.isArray(row.enabledPairs) ? row.enabledPairs : [],
    quoteAmount: row.maxPurchaseAmount,
    maxTradesPerHour: row.maxTradesPerHour,
    maxDailySpend: row.dailySpendingLimit,
    recvWindow: row.recvWindow,
    safetyEnabled: row.safetyEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// POST /configurations
// Create a new bot configuration.
export const createConfiguration = api(
  { method: "POST", path: "/configurations", expose: true },
  async (req: CreateConfigurationRequest): Promise<Configuration> => {
    validateCreateConfiguration(req);

    const now = new Date();

    const config: NewTradingConfiguration = {
      userId: DEFAULT_USER_ID,
      enabledPairs: req.symbols,
      maxPurchaseAmount: Math.round(req.quoteAmount),
      priceTolerance: 100,
      dailySpendingLimit: Math.round(req.maxDailySpend),
      maxTradesPerHour: req.maxTradesPerHour,
      pollingInterval: 5000,
      orderTimeout: 10_000,
      recvWindow: req.recvWindow,
      safetyEnabled: req.safetyEnabled,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    const [created] = await db
      .insert(tradingConfiguration)
      .values(config)
      .returning();

    if (!created) {
      throw new Error("Failed to create configuration");
    }

    return mapToConfiguration(created);
  }
);

// GET /configurations
// List configurations with simple pagination.
export const listConfigurations = api(
  { method: "GET", path: "/configurations", expose: true },
  async (
    req: ListConfigurationsRequest
  ): Promise<ListConfigurationsResponse> => {
    const limit = req.limit ?? 20;
    const offset = req.offset ?? 0;

    const rows = await db
      .select()
      .from(tradingConfiguration)
      .limit(limit)
      .offset(offset);

    const configurations = rows.map(mapToConfiguration);

    return {
      configurations,
      total: configurations.length,
      limit,
      offset,
      hasMore: configurations.length === limit,
    };
  }
);

// GET /configurations/:id
// Get a specific configuration by ID.
export const getConfiguration = api(
  { method: "GET", path: "/configurations/:id", expose: true },
  async (req: GetConfigurationRequest): Promise<Configuration> => {
    const [row] = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.id, req.id))
      .limit(1);

    if (!row) {
      throw new Error(`Configuration not found: ${req.id}`);
    }

    return mapToConfiguration(row);
  }
);

// DELETE /configurations/:id
// Delete a configuration by ID.
export const deleteConfiguration = api(
  { method: "DELETE", path: "/configurations/:id", expose: true },
  async (req: GetConfigurationRequest): Promise<void> => {
    await db
      .delete(tradingConfiguration)
      .where(eq(tradingConfiguration.id, req.id));
  }
);
