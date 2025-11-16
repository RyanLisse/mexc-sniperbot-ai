import { describe, it, expect, beforeEach } from "bun:test";
import { BotDB } from "../../db/db";
import { executeTrade } from "../../trade-executor/executor";
import type { TradeRequest } from "../../trade-executor/types";

/**
 * Contract-style tests for the executeTrade API.
 * These exercise the Encore API handler directly against the test database.
 */

describe("executeTrade API", () => {
  beforeEach(async () => {
    // Reset trades and config to a known baseline before each test.
    await BotDB.exec`DELETE FROM trades`;
    await BotDB.exec`
      UPDATE trade_config
      SET max_trade_usdt = 100.00,
          max_position_usdt = 1000.00,
          auto_trade = false,
          high_value_threshold_usdt = 500.00,
          updated_at = NOW()
      WHERE id = 1
    `;
  });

  it("rejects trades when auto_trade=false even below global cap", async () => {
    const req: TradeRequest = {
      symbol: "TESTUSDT",
      side: "buy",
      quoteQty: 5, // <= global cap
    };

    const res = await executeTrade(req);

    expect(res.status).toBe("rejected");
    expect(res.mode).toBe("dry-run");
    expect(res.errorReason).toBe("auto_trade_disabled");
    expect(res.tradeId).toBeGreaterThan(0);

    const row = await BotDB.queryRow<{
      id: number;
      symbol: string;
      mode: string;
      status: string;
      quote_qty: number;
      error_reason: string | null;
    }>`
      SELECT id, symbol, mode, status, quote_qty, error_reason
      FROM trades
      WHERE id = ${res.tradeId}
    `;

    expect(row).toBeTruthy();
    expect(row?.symbol).toBe("TESTUSDT");
    expect(row?.mode).toBe("dry-run");
    expect(row?.status).toBe("rejected");
    expect(row?.error_reason).toBe("auto_trade_disabled");
    expect(Number(row?.quote_qty)).toBe(5);
  });

  it("rejects trades exceeding the global $10 cap", async () => {
    // Enable auto_trade and keep max_trade_usdt high so the global cap dominates.
    await BotDB.exec`
      UPDATE trade_config
      SET max_trade_usdt = 100.00,
          max_position_usdt = 1000.00,
          auto_trade = true,
          high_value_threshold_usdt = 500.00,
          updated_at = NOW()
      WHERE id = 1
    `;

    const req: TradeRequest = {
      symbol: "BIGUSDT",
      side: "buy",
      quoteQty: 200,
    };

    const res = await executeTrade(req);

    expect(res.status).toBe("rejected");
    expect(res.mode).toBe("dry-run");
    expect(res.errorReason).toBe("exceeds_global_max_trade_usdt");

    const row = await BotDB.queryRow<{
      status: string;
      mode: string;
      error_reason: string | null;
    }>`
      SELECT status, mode, error_reason
      FROM trades
      WHERE id = ${res.tradeId}
    `;

    expect(row?.status).toBe("rejected");
    expect(row?.mode).toBe("dry-run");
    expect(row?.error_reason).toBe("exceeds_global_max_trade_usdt");
  });

  it("rejects trades exceeding config max_trade_usdt below the global cap", async () => {
    // Configure a stricter per-trade limit than the global cap.
    await BotDB.exec`
      UPDATE trade_config
      SET max_trade_usdt = 5.00,
          max_position_usdt = 1000.00,
          auto_trade = true,
          high_value_threshold_usdt = 500.00,
          updated_at = NOW()
      WHERE id = 1
    `;

    const req: TradeRequest = {
      symbol: "LIMITUSDT",
      side: "buy",
      quoteQty: 8, // <= global cap (10) but > config max_trade_usdt (5)
    };

    const res = await executeTrade(req);

    expect(res.status).toBe("rejected");
    expect(res.mode).toBe("dry-run");
    expect(res.errorReason).toBe("exceeds_max_trade_usdt");

    const row = await BotDB.queryRow<{
      status: string;
      mode: string;
      error_reason: string | null;
    }>`
      SELECT status, mode, error_reason
      FROM trades
      WHERE id = ${res.tradeId}
    `;

    expect(row?.status).toBe("rejected");
    expect(row?.mode).toBe("dry-run");
    expect(row?.error_reason).toBe("exceeds_max_trade_usdt");
  });
});
