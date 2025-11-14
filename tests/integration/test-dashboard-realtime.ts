import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createContext } from "@mexc-sniperbot-ai/api/context";
import { appRouter } from "@mexc-sniperbot-ai/api/routers/index";

describe("Dashboard Real-time Updates", () => {
  const ctx = createContext();

  beforeAll(async () => {
    // Setup test data if needed
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  it("should fetch dashboard snapshot", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getSnapshot({ limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.trades).toBeInstanceOf(Array);
    expect(result.data.listings).toBeInstanceOf(Array);
  });

  it("should fetch trade history", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getTradeHistory({ limit: 25 });

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
  });

  it("should fetch performance metrics", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getPerformanceMetrics({
      window: "24h",
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.window).toBe("24h");
  });

  it("should fetch alerts", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getAlerts({ limit: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
  });
});
