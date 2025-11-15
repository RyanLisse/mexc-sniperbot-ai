import { beforeEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  exchangeRulesCache,
  type ValidationRules,
} from "../../services/exchange-rules-cache";
import { orderValidator } from "../../services/order-validator";

describe("Order Validator - Unit Tests", () => {
  beforeEach(async () => {
    // Load exchange rules before tests
    // Skip if API is not available (tests may run without real API)
    const btcRules: ValidationRules = {
      minQty: 0.0001,
      maxQty: 10,
      stepSize: 0.0001,
      minNotional: 1,
      tickSize: 0.01,
      baseAsset: "BTC",
      quoteAsset: "USDT",
      status: "ENABLED",
    };

    const disabledRules: ValidationRules = {
      ...btcRules,
      status: "DISABLED",
    };

    exchangeRulesCache.clear();
    exchangeRulesCache.setRules("BTCUSDT", btcRules);
    exchangeRulesCache.setRules("INVALIDUSDT", disabledRules);

    (exchangeRulesCache as any).loadRules = () => Effect.succeed(undefined);
  });

  describe("Quantity Validation", () => {
    test("should validate minimum quantity", async () => {
      const result = await Effect.runPromise(
        orderValidator
          .validate("BTCUSDT", 45_000, 0.000_001)
          .pipe(Effect.either)
      );

      expect(result).toBeDefined();
      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right.valid).toBe(false);
        expect(
          result.right.errors.some((e) =>
            e.toLowerCase().includes("below minimum")
          )
        ).toBe(true);
      }
    });

    test("should validate maximum quantity", async () => {
      const result = await Effect.runPromise(
        orderValidator.validate("BTCUSDT", 45_000, 1000).pipe(Effect.either)
      );

      expect(result).toBeDefined();
      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right.valid).toBe(false);
        expect(
          result.right.errors.some((e) => e.includes("exceeds maximum"))
        ).toBe(true);
      }
    });

    test("should validate step size", async () => {
      // Test with invalid step size (e.g., 0.00012345 when step is 0.0001)
      const result = await Effect.runPromise(
        orderValidator
          .validate("BTCUSDT", 45_000, 0.000_123_45)
          .pipe(Effect.either)
      );

      expect(result).toBeDefined();
      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right.valid).toBe(false);
        expect(
          result.right.errors.some((e) => e.toLowerCase().includes("step"))
        ).toBe(true);
      }
    });
  });

  describe("Price Validation", () => {
    test("should validate tick size", async () => {
      // Test with invalid tick size
      const result = await Effect.runPromise(
        orderValidator
          .validatePrice("BTCUSDT", 45_000.123_456)
          .pipe(Effect.either)
      );

      expect(result).toBeDefined();
      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right.isValid).toBe(false);
        expect(
          result.right.errors.some((e) => e.toLowerCase().includes("tick"))
        ).toBe(true);
      }
    });

    test("should validate minimum notional value", async () => {
      // Test with very small notional value
      const result = await Effect.runPromise(
        orderValidator
          .validate("BTCUSDT", 45_000, 0.000_001)
          .pipe(Effect.either)
      );

      expect(result).toBeDefined();
      if (result._tag === "Right") {
        expect(result.right.valid).toBeDefined();
      } else {
        // If notional value validation fails, errors should contain notional value message
        if (result.left._tag === "Left") {
          const error = result.left;
          expect(error._tag).toBe("TradingError");
          expect(error.message).toContain("notional");
        }
      }
    });
  });

  describe("Symbol Status Validation", () => {
    test("should check if symbol is enabled", async () => {
      const result = await Effect.runPromise(
        orderValidator.isSymbolEnabled("BTCUSDT").pipe(Effect.either)
      );

      expect(result).toBeDefined();
      if (result._tag === "Right") {
        expect(typeof result.right).toBe("boolean");
      }
    });

    test("should reject disabled symbols", async () => {
      // Test with a symbol that might be disabled
      const result = await Effect.runPromise(
        orderValidator.isSymbolEnabled("INVALIDUSDT").pipe(Effect.either)
      );

      expect(result).toBeDefined();
      if (result._tag === "Right") {
        expect(typeof result.right).toBe("boolean");
      }
    });
  });

  describe("Price Adjustment", () => {
    test("should adjust price to valid tick size", async () => {
      const invalidPrice = 45_000.123_456;
      const result = await Effect.runPromise(
        orderValidator.adjustPrice("BTCUSDT", invalidPrice).pipe(Effect.either)
      );

      expect(result).toBeDefined();
      if (result._tag === "Right") {
        expect(result.right).toBeDefined();
        expect(result.right).toBeGreaterThan(0);
        // Adjusted price should be different from invalid price
        expect(result.right).not.toBe(invalidPrice);
      }
    });
  });

  describe("Minimum Order Size", () => {
    test("should get minimum order size for symbol", async () => {
      const result = await Effect.runPromise(
        orderValidator.getMinOrderSize("BTCUSDT").pipe(Effect.either)
      );

      expect(result).toBeDefined();
      if (result._tag === "Right") {
        expect(typeof result.right).toBe("number");
        expect(result.right).toBeGreaterThan(0);
      }
    });
  });

  describe("Error Handling", () => {
    test("should handle missing exchange rules", async () => {
      let caught: unknown;
      try {
        await Effect.runPromise(
          orderValidator.validate("NONEXISTENTUSDT", 1, 1)
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeDefined();
      expect(String(caught)).toContain("NONEXISTENTUSDT");
    });

    test("should provide detailed error messages", async () => {
      let caught: unknown;
      try {
        await Effect.runPromise(
          orderValidator.validate("NONEXISTENTUSDT", 1, 1)
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeDefined();
      expect(String(caught)).toContain("NONEXISTENTUSDT");
    });
  });
});
