import { describe, expect, it } from "bun:test";
import { configValidator } from "@mexc-sniperbot-ai/api/services/config-validator";
import { Effect } from "effect";

describe("Configuration Validation", () => {
  it("should validate valid configuration", async () => {
    const config = {
      enabledPairs: ["BTC/USDT", "ETH/USDT"],
      maxPurchaseAmount: 100,
      priceTolerance: 1.0,
      dailySpendingLimit: 1000,
      maxTradesPerHour: 10,
      pollingInterval: 5000,
      orderTimeout: 10_000,
      isActive: false,
    };

    const result = await Effect.runPromise(
      configValidator.validateConfiguration(config)
    );

    expect(result.enabledPairs).toEqual(["BTC/USDT", "ETH/USDT"]);
    expect(result.maxPurchaseAmount).toBe(100);
  });

  it("should reject invalid price tolerance", async () => {
    const config = {
      enabledPairs: ["BTC/USDT"],
      maxPurchaseAmount: 100,
      priceTolerance: 100, // Too high (>50%)
      dailySpendingLimit: 1000,
      maxTradesPerHour: 10,
      pollingInterval: 5000,
      orderTimeout: 10_000,
      isActive: false,
    };

    await expect(
      Effect.runPromise(configValidator.validateConfiguration(config))
    ).rejects.toThrow();
  });

  it("should reject max purchase amount exceeding daily limit", async () => {
    const config = {
      enabledPairs: ["BTC/USDT"],
      maxPurchaseAmount: 2000, // Exceeds daily limit
      priceTolerance: 1.0,
      dailySpendingLimit: 1000,
      maxTradesPerHour: 10,
      pollingInterval: 5000,
      orderTimeout: 10_000,
      isActive: false,
    };

    await expect(
      Effect.runPromise(configValidator.validateConfiguration(config))
    ).rejects.toThrow();
  });

  it("should reject polling interval below minimum", async () => {
    const config = {
      enabledPairs: ["BTC/USDT"],
      maxPurchaseAmount: 100,
      priceTolerance: 1.0,
      dailySpendingLimit: 1000,
      maxTradesPerHour: 10,
      pollingInterval: 500, // Too low (<1000ms)
      orderTimeout: 10_000,
      isActive: false,
    };

    await expect(
      Effect.runPromise(configValidator.validateConfiguration(config))
    ).rejects.toThrow();
  });
});
