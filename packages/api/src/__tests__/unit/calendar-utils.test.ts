import { describe, expect, test } from "bun:test";
import {
  filterListingsByTimeWindow,
  filterTodaysListings,
  filterTomorrowsListings,
  isTodayListing,
  isTomorrowListing,
  isUpcomingListing,
} from "../../services/calendar-utils";
import type { CalendarEntry } from "../../services/mexc-client";

describe("Calendar Utils - Unit Tests", () => {
  const createMockEntry = (
    hoursFromNow: number,
    vcoinId = "test-coin",
    symbol = "TESTUSDT"
  ): CalendarEntry => {
    const firstOpenTime = Date.now() + hoursFromNow * 60 * 60 * 1000;
    return {
      vcoinId,
      symbol,
      vcoinName: symbol.replace("USDT", ""),
      vcoinNameFull: `Test ${symbol}`,
      firstOpenTime,
      zone: "UTC",
    };
  };

  describe("isTodayListing", () => {
    test("should identify today's listings", () => {
      const today = new Date();
      today.setHours(14, 0, 0, 0); // 2 PM today
      const entry = createMockEntry(0);
      entry.firstOpenTime = today.getTime();

      expect(isTodayListing(entry)).toBe(true);
    });

    test("should reject yesterday's listings", () => {
      const entry = createMockEntry(-24); // 24 hours ago
      expect(isTodayListing(entry)).toBe(false);
    });

    test("should reject tomorrow's listings", () => {
      const entry = createMockEntry(24); // 24 hours from now
      expect(isTodayListing(entry)).toBe(false);
    });

    test("should handle entries without firstOpenTime", () => {
      const entry: CalendarEntry = {
        vcoinId: "test",
        symbol: "TESTUSDT",
        vcoinName: "TEST",
        vcoinNameFull: "Test",
        firstOpenTime: 0,
      };
      expect(isTodayListing(entry)).toBe(false);
    });
  });

  describe("isTomorrowListing", () => {
    test("should identify tomorrow's listings", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0); // Noon tomorrow
      const entry = createMockEntry(0);
      entry.firstOpenTime = tomorrow.getTime();

      expect(isTomorrowListing(entry)).toBe(true);
    });

    test("should reject today's listings", () => {
      // Create entry for today (not tomorrow)
      const today = new Date();
      today.setHours(14, 0, 0, 0); // 2 PM today
      const entry = createMockEntry(0);
      entry.firstOpenTime = today.getTime();
      expect(isTomorrowListing(entry)).toBe(false);
    });

    test("should reject day after tomorrow's listings", () => {
      const entry = createMockEntry(48); // 48 hours from now
      expect(isTomorrowListing(entry)).toBe(false);
    });
  });

  describe("isUpcomingListing", () => {
    test("should identify upcoming listings within time window", () => {
      const entry = createMockEntry(12); // 12 hours from now
      expect(isUpcomingListing(entry, 24)).toBe(true);
    });

    test("should reject past listings", () => {
      const entry = createMockEntry(-1); // 1 hour ago
      expect(isUpcomingListing(entry, 24)).toBe(false);
    });

    test("should reject listings beyond time window", () => {
      const entry = createMockEntry(50); // 50 hours from now
      expect(isUpcomingListing(entry, 24)).toBe(false);
    });

    test("should use default 48 hour window", () => {
      const entry = createMockEntry(36); // 36 hours from now
      expect(isUpcomingListing(entry)).toBe(true);
    });
  });

  describe("filterListingsByTimeWindow", () => {
    test("should filter listings within time window", () => {
      const entries: CalendarEntry[] = [
        createMockEntry(12, "coin-1", "COIN1USDT"), // 12 hours
        createMockEntry(36, "coin-2", "COIN2USDT"), // 36 hours
        createMockEntry(72, "coin-3", "COIN3USDT"), // 72 hours (beyond 48h)
        createMockEntry(-1, "coin-4", "COIN4USDT"), // Past
      ];

      const filtered = filterListingsByTimeWindow(entries, 48);

      expect(filtered.length).toBeGreaterThanOrEqual(2); // Should include coin-1 and coin-2
      expect(filtered.every((e) => e.firstOpenTime > Date.now())).toBe(true);
    });

    test("should always include tomorrow's listings", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const entries: CalendarEntry[] = [
        {
          vcoinId: "tomorrow-coin",
          symbol: "TOMORROWUSDT",
          vcoinName: "TOMORROW",
          vcoinNameFull: "Tomorrow Coin",
          firstOpenTime: tomorrow.getTime(),
        },
        createMockEntry(72, "future-coin", "FUTUREUSDT"), // Beyond window
      ];

      const filtered = filterListingsByTimeWindow(entries, 24);

      expect(filtered.some((e) => e.vcoinId === "tomorrow-coin")).toBe(true);
    });

    test("should filter out invalid entries", () => {
      const entries: CalendarEntry[] = [
        createMockEntry(12, "valid-1", "VALID1USDT"),
        {
          vcoinId: "",
          symbol: "INVALIDUSDT",
          vcoinName: "",
          vcoinNameFull: "",
          firstOpenTime: Date.now() + 12 * 60 * 60 * 1000,
        },
        {
          vcoinId: "valid-2",
          symbol: "",
          vcoinName: "VALID2",
          vcoinNameFull: "Valid 2",
          firstOpenTime: Date.now() + 12 * 60 * 60 * 1000,
        },
      ];

      const filtered = filterListingsByTimeWindow(entries, 24);

      // Should only include entries with both vcoinId and vcoinName
      expect(filtered.every((e) => e.vcoinId && e.vcoinName)).toBe(true);
    });
  });

  describe("filterTodaysListings", () => {
    test("should return only today's listings", () => {
      const today = new Date();
      today.setHours(14, 0, 0, 0);

      const entries: CalendarEntry[] = [
        {
          vcoinId: "today-1",
          symbol: "TODAY1USDT",
          vcoinName: "TODAY1",
          vcoinNameFull: "Today 1",
          firstOpenTime: today.getTime(),
        },
        createMockEntry(24, "tomorrow-1", "TOMORROW1USDT"),
        createMockEntry(-24, "yesterday-1", "YESTERDAY1USDT"),
      ];

      const filtered = filterTodaysListings(entries);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.vcoinId).toBe("today-1");
    });
  });

  describe("filterTomorrowsListings", () => {
    test("should return only tomorrow's listings", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const entries: CalendarEntry[] = [
        {
          vcoinId: "tomorrow-1",
          symbol: "TOMORROW1USDT",
          vcoinName: "TOMORROW1",
          vcoinNameFull: "Tomorrow 1",
          firstOpenTime: tomorrow.getTime(),
        },
        createMockEntry(0, "today-1", "TODAY1USDT"),
        createMockEntry(48, "day-after-1", "DAYAFTER1USDT"),
      ];

      const filtered = filterTomorrowsListings(entries);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.vcoinId).toBe("tomorrow-1");
    });
  });
});
