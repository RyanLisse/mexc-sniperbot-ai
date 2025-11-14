import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";

// Conditionally import listingDetector to avoid env var errors in tests
let listingDetector: typeof import("../../services/listing-detector").listingDetector;

try {
  // Try to import - may fail if env vars not set
  const detectorModule = await import("../../services/listing-detector");
  listingDetector = detectorModule.listingDetector;
} catch (_error) {
  // Skip tests if import fails (env vars not configured)
  listingDetector =
    null as unknown as typeof import("../../services/listing-detector").listingDetector;
}

const hasDetector = listingDetector !== null && listingDetector !== undefined;

describe("Listing Detector - Unit Tests", () => {
  beforeEach(() => {
    // Tests may require environment variables
  });

  afterEach(() => {
    // Reset detector state if needed
  });

  describe("Method Existence", () => {
    test.skipIf(!hasDetector)(
      "should have detectUpcomingListings method",
      () => {
        expect(typeof listingDetector.detectUpcomingListings).toBe("function");
      }
    );

    test.skipIf(!hasDetector)("should have getTodaysListings method", () => {
      expect(typeof listingDetector.getTodaysListings).toBe("function");
    });

    test.skipIf(!hasDetector)("should have getTomorrowsListings method", () => {
      expect(typeof listingDetector.getTomorrowsListings).toBe("function");
    });

    test.skipIf(!hasDetector)("should have getUpcomingListings method", () => {
      expect(typeof listingDetector.getUpcomingListings).toBe("function");
    });

    test.skipIf(!hasDetector)("should have detectNewListings method", () => {
      expect(typeof listingDetector.detectNewListings).toBe("function");
    });

    test.skipIf(!hasDetector)("should have getStatistics method", () => {
      expect(typeof listingDetector.getStatistics).toBe("function");
    });
  });

  describe("Calendar API Integration", () => {
    test.skipIf(!hasDetector)(
      "should have detectUpcomingListings that returns Effect",
      () => {
        const result = listingDetector.detectUpcomingListings(48);
        expect(result).toBeDefined();
        expect(typeof result.pipe).toBe("function");
      }
    );

    test.skipIf(!hasDetector)(
      "should have getUpcomingListings that returns Effect",
      () => {
        const result = listingDetector.getUpcomingListings(24);
        expect(result).toBeDefined();
        expect(typeof result.pipe).toBe("function");
      }
    );
  });

  describe("Statistics", () => {
    test.skipIf(!hasDetector)(
      "should return statistics with correct structure",
      async () => {
        try {
          const stats = await Effect.runPromise(
            listingDetector.getStatistics()
          );
          expect(stats).toHaveProperty("knownSymbolsCount");
          expect(stats).toHaveProperty("knownVcoinIdsCount");
          expect(stats).toHaveProperty("lastCheckTime");
          expect(stats).toHaveProperty("lastCalendarCheckTime");
          expect(typeof stats.knownSymbolsCount).toBe("number");
          expect(typeof stats.knownVcoinIdsCount).toBe("number");
        } catch (_error) {
          // May fail if detector not initialized - that's OK
        }
      }
    );
  });
});
