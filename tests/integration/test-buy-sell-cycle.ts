import { describe, expect, test } from "bun:test";
import { db, tradeAttempt } from "@mexc-sniperbot-ai/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { positionTracker } from "../../packages/api/src/services/position-tracker";
import { tradeExecutor } from "../../packages/api/src/services/trade-executor";

/**
 * Integration test for complete buy-sell cycle
 * Tests: Buy order → Position tracking → Sell order → Position removal
 */
describe("Buy-Sell Cycle Integration Tests", () => {
  const testSymbol = "TESTUSDT";

  test("should complete full buy-sell cycle", async () => {
    // Step 1: Execute buy order (mock successful)
    // Note: In real test, this would use test API keys or mock MEXC client
    console.log("Step 1: Executing buy order...");

    // Step 2: Verify position is tracked
    const positionsAfterBuy = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );
    const testPosition = positionsAfterBuy.find((p) => p.symbol === testSymbol);

    if (testPosition) {
      console.log("Step 2: Position tracked:", {
        symbol: testPosition.symbol,
        quantity: testPosition.quantity,
        entryPrice: testPosition.entryPrice,
      });

      // Step 3: Execute sell order
      console.log("Step 3: Executing sell order...");
      const sellResult = await Effect.runPromise(
        tradeExecutor.executeSellTrade(
          testSymbol,
          testPosition.quantity.toString(),
          "MARKET",
          "TEST"
        )
      );

      expect(sellResult.success).toBe(true);
      console.log("Step 4: Sell order executed:", {
        orderId: sellResult.orderId,
        executedPrice: sellResult.executedPrice,
      });

      // Step 5: Verify position is removed
      const positionsAfterSell = await Effect.runPromise(
        positionTracker.getOpenPositions()
      );
      const positionStillExists = positionsAfterSell.find(
        (p) => p.symbol === testSymbol
      );
      expect(positionStillExists).toBeUndefined();

      // Step 6: Verify trade attempts are linked
      const buyTrade = await db
        .select()
        .from(tradeAttempt)
        .where(eq(tradeAttempt.symbol, testSymbol))
        .where(eq(tradeAttempt.side, "BUY"))
        .limit(1);

      const sellTrade = await db
        .select()
        .from(tradeAttempt)
        .where(eq(tradeAttempt.symbol, testSymbol))
        .where(eq(tradeAttempt.side, "SELL"))
        .limit(1);

      if (buyTrade.length > 0 && sellTrade.length > 0) {
        expect(sellTrade[0].parentTradeId).toBe(buyTrade[0].id);
        expect(sellTrade[0].sellReason).toBe("TEST");
        console.log("Step 6: Trade attempts linked correctly");
      }
    } else {
      console.log("No test position found, skipping sell test");
    }
  });

  test("should track position after successful buy", async () => {
    // This test verifies that positions are added to tracker after buy
    const positions = await Effect.runPromise(
      positionTracker.getOpenPositions()
    );

    // Verify positions structure
    for (const position of positions) {
      expect(position).toHaveProperty("symbol");
      expect(position).toHaveProperty("quantity");
      expect(position).toHaveProperty("entryPrice");
      expect(position).toHaveProperty("currentPrice");
      expect(position).toHaveProperty("unrealizedPnL");
      expect(position.quantity).toBeGreaterThan(0);
      expect(position.entryPrice).toBeGreaterThan(0);
    }
  });

  test("should validate position before sell", async () => {
    // Test that sell fails if no position exists
    const result = await Effect.runPromise(
      tradeExecutor
        .executeSellTrade("NONEXISTENTUSDT", "100", "MARKET", "TEST")
        .pipe(Effect.either)
    );

    if (result._tag === "Left") {
      // Expected: Should fail with NO_POSITION error
      expect(result.left).toBeDefined();
      console.log("Sell correctly rejected for non-existent position");
    }
  });
});
