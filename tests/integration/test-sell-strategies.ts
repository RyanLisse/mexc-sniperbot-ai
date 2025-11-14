import { describe, expect, test } from "bun:test";
import { db, tradingConfiguration } from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { positionMonitor } from "../../packages/api/src/services/position-monitor";
import { positionTracker } from "../../packages/api/src/services/position-tracker";

/**
 * Integration test for sell strategies
 * Tests: Profit target, stop loss, time-based exit, combined strategy
 */
describe("Sell Strategies Integration Tests", () => {
  test("should evaluate profit target strategy", async () => {
    const configs = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.isActive, true))
      .limit(1);

    if (configs.length === 0) {
      console.log("No active configuration found, skipping test");
      return;
    }

    const config = { ...configs[0], sellStrategy: "PROFIT_TARGET" };
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    for (const position of positions.slice(0, 1)) {
      // Mock a position that has reached profit target
      const profitTargetPercent = config.profitTargetPercent || 500; // 5%
      const profitTargetPrice =
        position.entryPrice * (1 + profitTargetPercent / 10_000);

      // Update position with profit target price
      await Effect.runPromise(
        positionTracker.updatePosition(position.symbol, {
          currentPrice: profitTargetPrice,
        })
      );

      const updatedPosition = await Effect.runPromise(
        positionTracker.getPosition(position.symbol)
      );

      if (updatedPosition) {
        const sellCondition = await Effect.runPromise(
          positionMonitor.checkPosition(updatedPosition, config)
        );

        // Should trigger sell if profit target met
        if (updatedPosition.currentPrice >= profitTargetPrice) {
          expect(sellCondition.shouldSell).toBe(true);
          expect(sellCondition.reason).toBe("PROFIT_TARGET");
        }
      }
    }
  });

  test("should evaluate stop loss strategy", async () => {
    const configs = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.isActive, true))
      .limit(1);

    if (configs.length === 0) {
      console.log("No active configuration found, skipping test");
      return;
    }

    const config = { ...configs[0], sellStrategy: "STOP_LOSS" };
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    for (const position of positions.slice(0, 1)) {
      // Mock a position that has triggered stop loss
      const stopLossPercent = config.stopLossPercent || 200; // 2%
      const stopLossPrice =
        position.entryPrice * (1 - stopLossPercent / 10_000);

      // Update position with stop loss price
      await Effect.runPromise(
        positionTracker.updatePosition(position.symbol, {
          currentPrice: stopLossPrice,
        })
      );

      const updatedPosition = await Effect.runPromise(
        positionTracker.getPosition(position.symbol)
      );

      if (updatedPosition) {
        const sellCondition = await Effect.runPromise(
          positionMonitor.checkPosition(updatedPosition, config)
        );

        // Should trigger sell if stop loss triggered
        if (updatedPosition.currentPrice <= stopLossPrice) {
          expect(sellCondition.shouldSell).toBe(true);
          expect(sellCondition.reason).toBe("STOP_LOSS");
        }
      }
    }
  });

  test("should evaluate time-based exit strategy", async () => {
    const configs = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.isActive, true))
      .limit(1);

    if (configs.length === 0) {
      console.log("No active configuration found, skipping test");
      return;
    }

    const config = { ...configs[0], sellStrategy: "TIME_BASED" };
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    for (const position of positions.slice(0, 1)) {
      const timeBasedExitMinutes = config.timeBasedExitMinutes || 60;
      const entryTime = position.entryTime.getTime();
      const currentTime = Date.now();
      const timeBasedExitMs = timeBasedExitMinutes * 60 * 1000;
      const timeBasedExitMet = currentTime >= entryTime + timeBasedExitMs;

      const sellCondition = await Effect.runPromise(
        positionMonitor.checkPosition(position, config)
      );

      if (timeBasedExitMet) {
        expect(sellCondition.shouldSell).toBe(true);
        expect(sellCondition.reason).toBe("TIME_BASED");
      }
    }
  });

  test("should evaluate combined strategy", async () => {
    const configs = await db
      .select()
      .from(tradingConfiguration)
      .where(eq(tradingConfiguration.isActive, true))
      .limit(1);

    if (configs.length === 0) {
      console.log("No active configuration found, skipping test");
      return;
    }

    const config = { ...configs[0], sellStrategy: "COMBINED" };
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    for (const position of positions.slice(0, 1)) {
      const sellCondition = await Effect.runPromise(
        positionMonitor.checkPosition(position, config)
      );

      // Combined strategy should check all conditions
      expect(sellCondition).toHaveProperty("shouldSell");
      expect(sellCondition).toHaveProperty("reason");

      // If any condition is met, shouldSell should be true
      if (sellCondition.shouldSell) {
        expect(["PROFIT_TARGET", "STOP_LOSS", "TIME_BASED"]).toContain(
          sellCondition.reason
        );
      }
    }
  });
});
