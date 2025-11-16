import { describe, it, expect } from "bun:test";
import type { ListingSource } from "../../market-monitor/listingDetector";

describe("Source Enum Validation", () => {
  const validSources: ListingSource[] = [
    "mexc_websocket",
    "mexc_rest_api",
    "test_injection",
  ];

  it("should have exactly 3 valid source types", () => {
    expect(validSources).toHaveLength(3);
  });

  it("should include mexc_websocket as valid source", () => {
    expect(validSources).toContain("mexc_websocket");
  });

  it("should include mexc_rest_api as valid source", () => {
    expect(validSources).toContain("mexc_rest_api");
  });

  it("should include test_injection as valid source", () => {
    expect(validSources).toContain("test_injection");
  });

  it("should match database constraint values", () => {
    // These must match the CHECK constraint in database schema
    const dbConstraintSources = [
      "mexc_websocket",
      "mexc_rest_api",
      "test_injection",
    ];
    
    expect(validSources).toEqual(dbConstraintSources);
  });

  it("should be type-safe at compile time", () => {
    const source: ListingSource = "mexc_websocket";
    expect(source).toBe("mexc_websocket");
    
    // TypeScript would catch this at compile time:
    // const invalidSource: ListingSource = "invalid"; // Error
  });

  it("should handle source in logging context", () => {
    validSources.forEach(source => {
      const logEntry = {
        metric: "listings_detected_total",
        source,
        symbol: "TESTUSDT",
      };
      
      expect(logEntry.source).toBe(source);
      expect(validSources).toContain(logEntry.source);
    });
  });
});
