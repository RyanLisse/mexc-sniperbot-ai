import {
  db,
  type NewTradingConfiguration,
  type TradingConfiguration,
  tradingConfiguration,
} from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";

/**
 * BotConfiguration entity queries for Encore backend
 * Maps to existing trading_configurations table
 */
export class ConfigurationService {
  /**
   * Create a new bot configuration
   */
  static async create(
    config: NewTradingConfiguration
  ): Promise<TradingConfiguration> {
    const [created] = await db
      .insert(tradingConfiguration)
      .values(config)
      .returning();

    if (!created) {
      throw new Error("Failed to create configuration");
    }

    return created;
  }

  /**
   * List all configurations for a user
   */
  static async list(userId: string): Promise<TradingConfiguration[]> {
    return await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.userId, userId));
  }

  /**
   * Get a specific configuration by ID
   */
  static async getById(id: string): Promise<TradingConfiguration | null> {
    const [config] = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.id, id))
      .limit(1);

    return config || null;
  }

  /**
   * Get active configuration for a user
   */
  static async getActive(userId: string): Promise<TradingConfiguration | null> {
    const [config] = await db
      .select()
      .from(tradingConfiguration)
      .where(
        and(
          eq(tradingConfiguration.userId, userId),
          eq(tradingConfiguration.isActive, true)
        )
      )
      .limit(1);

    return config || null;
  }
}
