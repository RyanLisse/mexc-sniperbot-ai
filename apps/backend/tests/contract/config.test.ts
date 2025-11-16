import { describe, it, expect, beforeEach } from "bun:test";
import { BotDB } from "../../db/db";
import { getConfig, updateConfig } from "../../risk-manager/config";

/**
 * Contract-style tests for the config API (getConfig / updateConfig)
 * These run against the real Encore test database via BotDB.
 */

describe("Config API", () => {
  beforeEach(async () => {
    // Reset the default config to a known baseline before each test.
    await BotDB.exec`
      UPDATE trade_config
      SET max_trade_usdt = 100.00,
          max_position_usdt = 1000.00,
          auto_trade = false,
          high_value_threshold_usdt = 500.00,
          updated_at = NOW()
      WHERE id = 1
    `;
  });

  it("returns the current configuration via getConfig", async () => {
    const config = await getConfig();

    expect(config.maxTradeUsdt).toBe(100);
    expect(config.maxPositionUsdt).toBe(1000);
    expect(config.autoTrade).toBe(false);
    expect(config.highValueThresholdUsdt).toBe(500);
  });

  it("updates selected fields via updateConfig and preserves others", async () => {
    const updated = await updateConfig({ maxTradeUsdt: 200 });

    expect(updated.maxTradeUsdt).toBe(200);
    // Other fields should remain unchanged from the baseline
    expect(updated.maxPositionUsdt).toBe(1000);
    expect(updated.autoTrade).toBe(false);
    expect(updated.highValueThresholdUsdt).toBe(500);
  });

  it("rejects non-positive maxTradeUsdt", async () => {
    await expect(updateConfig({ maxTradeUsdt: 0 })).rejects.toThrow(
      /max_trade_usdt must be positive/i,
    );

    await expect(updateConfig({ maxTradeUsdt: -10 })).rejects.toThrow(
      /max_trade_usdt must be positive/i,
    );
  });

  it("rejects maxPositionUsdt < maxTradeUsdt when both provided", async () => {
    await expect(
      updateConfig({ maxTradeUsdt: 200, maxPositionUsdt: 100 }),
    ).rejects.toThrow(/max_position_usdt must be >= max_trade_usdt/i);
  });
});
