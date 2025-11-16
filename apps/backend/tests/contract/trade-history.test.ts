import { describe, it, expect, beforeEach } from "bun:test";
import { BotDB } from "../../db/db";
import { getTradeHistory } from "../../trade-executor/history";
import type { TradeHistoryRequest } from "../../trade-executor/history";

/**
 * Contract-style tests for the trade history API.
 * Uses the real BotDB and getTradeHistory Encore endpoint.
 */

describe("getTradeHistory API", () => {
  beforeEach(async () => {
    await BotDB.exec`DELETE FROM trades`;

    // Insert a few trades with different modes/statuses
    await BotDB.exec`
      INSERT INTO trades (symbol, side, quote_qty, latency_ms, mode, status)
      VALUES
        ('AAAUSDT', 'BUY', 10.00, 10, 'dry-run', 'filled'),
        ('BBBUSDT', 'BUY', 20.00, 20, 'live', 'failed'),
        ('CCCUSDT', 'SELL', 30.00, 30, 'live', 'filled')
    `;
  });

  it("returns paginated trades sorted by created_at desc", async () => {
    const req: TradeHistoryRequest = { limit: 2, offset: 0 };
    const res = await getTradeHistory(req);

    expect(res.limit).toBe(2);
    expect(res.offset).toBe(0);
    expect(res.total).toBe(3);
    expect(res.trades.length).toBe(2);

    // The most recently inserted trade (CCCUSDT) should appear first
    expect(res.trades[0].symbol).toBe("CCCUSDT");
  });

  it("filters by mode=live", async () => {
    const req: TradeHistoryRequest = { mode: "live" };
    const res = await getTradeHistory(req);

    expect(res.total).toBe(2);
    expect(res.trades.length).toBe(2);
    res.trades.forEach((t) => {
      expect(t.mode).toBe("live");
    });
  });

  it("filters by status=failed", async () => {
    const req: TradeHistoryRequest = { status: "failed" };
    const res = await getTradeHistory(req);

    expect(res.total).toBe(1);
    expect(res.trades.length).toBe(1);
    expect(res.trades[0].status).toBe("failed");
    expect(res.trades[0].symbol).toBe("BBBUSDT");
  });
});
