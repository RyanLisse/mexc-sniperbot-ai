import { describe, it, expect } from "bun:test";
import { calculateBackoffDelay, DEFAULT_BACKOFF_CONFIG } from "../../market-monitor/backoff";

describe("Exponential Backoff", () => {
  it("should calculate correct delays for exponential backoff", () => {
    // Test exponential progression: 1s, 2s, 4s, 8s
    expect(calculateBackoffDelay(0)).toBe(1000); // 1s
    expect(calculateBackoffDelay(1)).toBe(2000); // 2s
    expect(calculateBackoffDelay(2)).toBe(4000); // 4s
    expect(calculateBackoffDelay(3)).toBe(8000); // 8s
  });

  it("should cap delay at maximum (30s)", () => {
    // Should never exceed max delay of 30s
    expect(calculateBackoffDelay(10)).toBe(30000);
    expect(calculateBackoffDelay(20)).toBe(30000);
    expect(calculateBackoffDelay(100)).toBe(30000);
  });

  it("should handle attempt 0 correctly", () => {
    expect(calculateBackoffDelay(0)).toBe(1000);
  });

  it("should use custom config when provided", () => {
    const customConfig = {
      initialDelay: 500,
      maxDelay: 10000,
      multiplier: 3,
    };

    expect(calculateBackoffDelay(0, customConfig)).toBe(500);
    expect(calculateBackoffDelay(1, customConfig)).toBe(1500);
    expect(calculateBackoffDelay(2, customConfig)).toBe(4500);
    expect(calculateBackoffDelay(10, customConfig)).toBe(10000); // capped
  });

  it("should use default config values", () => {
    expect(DEFAULT_BACKOFF_CONFIG.initialDelay).toBe(1000);
    expect(DEFAULT_BACKOFF_CONFIG.maxDelay).toBe(30000);
    expect(DEFAULT_BACKOFF_CONFIG.multiplier).toBe(2);
  });
});
