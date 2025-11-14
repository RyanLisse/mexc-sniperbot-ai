import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { orderValidator } from "../../services/order-validator";
import { riskManager } from "../../services/risk-manager";

describe("Performance Tests - Throughput", () => {
  describe("Order Validation Throughput", () => {
    test("should handle 1000+ validations per second", async () => {
      const startTime = performance.now();
      const promises: Promise<unknown>[] = [];

      // Execute 1000 validations
      for (let i = 0; i < 1000; i++) {
        promises.push(
          Effect.runPromise(
            orderValidator.validate("BTCUSDT", 45_000, 0.01)
          ).catch(() => {
            // Ignore errors
          })
        );
      }

      await Promise.all(promises);
      const duration = performance.now() - startTime;
      const throughput = 1000 / (duration / 1000); // ops per second

      // Should handle at least 1000 ops/sec
      expect(throughput).toBeGreaterThan(1000);
    });
  });

  describe("Risk Manager Throughput", () => {
    test("should handle 1000+ risk validations per second", async () => {
      const startTime = performance.now();
      const promises: Promise<unknown>[] = [];

      // Execute 1000 risk validations
      for (let i = 0; i < 1000; i++) {
        promises.push(
          Effect.runPromise(
            riskManager.validateOrder({
              symbol: "BTCUSDT",
              quantity: 0.01,
              price: 45_000,
              side: "BUY",
              portfolioValue: 10_000,
              dailyPnL: 0,
            })
          ).catch(() => {
            // Ignore errors
          })
        );
      }

      await Promise.all(promises);
      const duration = performance.now() - startTime;
      const throughput = 1000 / (duration / 1000); // ops per second

      // Should handle at least 1000 ops/sec
      expect(throughput).toBeGreaterThan(1000);
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle 100 concurrent order validations", async () => {
      const startTime = performance.now();
      const promises: Promise<unknown>[] = [];

      // Execute 100 concurrent validations
      for (let i = 0; i < 100; i++) {
        promises.push(
          Effect.runPromise(
            orderValidator.validate("BTCUSDT", 45_000, 0.01)
          ).catch(() => {
            // Ignore errors
          })
        );
      }

      await Promise.all(promises);
      const duration = performance.now() - startTime;

      // Should complete 100 concurrent operations quickly
      expect(duration).toBeLessThan(1000); // < 1 second
    });
  });
});
