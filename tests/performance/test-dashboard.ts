import { describe, expect, it } from "bun:test";
import { createContext } from "@mexc-sniperbot-ai/api/context";
import { appRouter } from "@mexc-sniperbot-ai/api/routers/index";

describe("Dashboard Performance", () => {
  const ctx = createContext();

  it("should fetch dashboard snapshot within 1 second", async () => {
    const caller = appRouter.createCaller(ctx);
    const startTime = Date.now();

    await caller.dashboard.getSnapshot({ limit: 25 });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it("should fetch trade history efficiently", async () => {
    const caller = appRouter.createCaller(ctx);
    const startTime = Date.now();

    await caller.dashboard.getTradeHistory({ limit: 50 });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500); // Should complete within 500ms
  });

  it("should fetch performance metrics efficiently", async () => {
    const caller = appRouter.createCaller(ctx);
    const startTime = Date.now();

    await caller.dashboard.getPerformanceMetrics({ window: "24h" });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
