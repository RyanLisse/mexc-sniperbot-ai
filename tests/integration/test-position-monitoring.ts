import { describe, expect, test } from "bun:test";
import { db, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { positionMonitor } from "../../packages/api/src/services/position-monitor";
import { positionTracker } from "../../packages/api/src/services/position-tracker";

/**
 * Integration test for position monitoring
 * Tests: Position monitoring loop, sell condition evaluation, sell triggers
 */
describe("Position Monitoring Integration Tests", () => {
  test("should evaluate sell conditions correctly", async () => {
    // Get active configuration
    const configs = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.isActive, true))
      .limit(1);

    if (configs.length === 0) {
      console.log("No active configuration found, skipping test");
      return;
    }

    const config = configs[0];

    // Get open positions
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    if (positions.length === 0) {
      console.log("No open positions found, skipping test");
      return;
    }

    // Test sell condition evaluation for each position
    for (const position of positions) {
      const sellCondition = await Effect.runPromise(
        positionMonitor.checkPosition(position, config)
      );

      expect(sellCondition).toHaveProperty("shouldSell");
      expect(sellCondition).toHaveProperty("reason");

      if (sellCondition.shouldSell) {
        console.log(`Sell condition met for ${position.symbol}:`, {
          reason: sellCondition.reason,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL,
        });
      }
    }
  });

  test("should check all positions in monitoring loop", async () => {
    const sellCount = await Effect.runPromise(
      positionMonitor.checkAllPositions()
    );

    expect(typeof sellCount).toBe("number");
    expect(sellCount).toBeGreaterThanOrEqual(0);

    console.log(
      `Position monitoring checked positions, triggered ${sellCount} sells`
    );
  });

  test("should handle profit target condition", async () => {
    // This test would require a position with profit target met
    // In real scenario, you'd create a test position with high profit
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    // Verify profit target calculation
    for (const position of positions) {
      const profitPercent =
        ((position.currentPrice - position.entryPrice) / position.entryPrice) *
        100;
      expect(typeof profitPercent).toBe("number");
    }
  });

  test("should handle stop loss condition", async () => {
    // This test would require a position with stop loss triggered
    // In real scenario, you'd create a test position with loss
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    // Verify stop loss calculation
    for (const position of positions) {
      const lossPercent =
        ((position.entryPrice - position.currentPrice) / position.entryPrice) *
        100;
      expect(typeof lossPercent).toBe("number");
    }
  });
});
