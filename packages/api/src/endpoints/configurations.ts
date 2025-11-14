import { api } from "encore.dev/api";
import { ConfigurationService } from "../services/configuration-service";
import { ConfigurationValidator } from "../lib/configuration-validator";
import type { NewTradingConfiguration, TradingConfiguration } from "@mexc-sniperbot-ai/db";

interface CreateConfigRequest {
  userId: string;
  symbols: string[];
  maxPurchaseAmount: number;
  maxTradesPerHour: number;
  dailySpendingLimit: number;
  recvWindow?: number;
  safetyEnabled?: boolean;
}

interface CreateConfigResponse {
  configuration: TradingConfiguration;
}

interface ListConfigsRequest {
  userId: string;
}

interface ListConfigsResponse {
  configurations: TradingConfiguration[];
}

interface GetConfigRequest {
  id: string;
}

interface GetConfigResponse {
  configuration: TradingConfiguration | null;
}

/**
 * Create a new bot configuration
 */
export const createConfiguration = api(
  { method: "POST", path: "/configurations", expose: true },
  async (req: CreateConfigRequest): Promise<CreateConfigResponse> => {
    // Validate configuration
    const validation = ConfigurationValidator.validate({
      enabledPairs: req.symbols,
      maxPurchaseAmount: req.maxPurchaseAmount,
      maxTradesPerHour: req.maxTradesPerHour,
      dailySpendingLimit: req.dailySpendingLimit,
      recvWindow: req.recvWindow,
    });

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Create configuration
    const config: NewTradingConfiguration = {
      userId: req.userId,
      enabledPairs: req.symbols,
      maxPurchaseAmount: req.maxPurchaseAmount,
      maxTradesPerHour: req.maxTradesPerHour,
      dailySpendingLimit: req.dailySpendingLimit,
      recvWindow: req.recvWindow ?? 1000,
      safetyEnabled: req.safetyEnabled ?? true,
      priceTolerance: 100, // 1% default
      pollingInterval: 5000,
      orderTimeout: 10000,
    };

    const configuration = await ConfigurationService.create(config);
    return { configuration };
  }
);

/**
 * List all configurations for a user
 */
export const listConfigurations = api(
  { method: "GET", path: "/configurations", expose: true },
  async (req: ListConfigsRequest): Promise<ListConfigsResponse> => {
    const configurations = await ConfigurationService.list(req.userId);
    return { configurations };
  }
);

/**
 * Get a specific configuration by ID
 */
export const getConfiguration = api(
  { method: "GET", path: "/configurations/:id", expose: true },
  async (req: GetConfigRequest): Promise<GetConfigResponse> => {
    const configuration = await ConfigurationService.getById(req.id);
    
    if (!configuration) {
      throw new Error(`Configuration not found: ${req.id}`);
    }
    
    return { configuration };
  }
);
