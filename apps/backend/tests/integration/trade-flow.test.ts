import { describe, it, expect, beforeEach } from "bun:test";
import { BotDB } from "../../db/db";
import { executeTrade } from "../../trade-executor/executor";
import type { TradeRequest } from "../../trade-executor/types";

/**
 * Integration tests for trade execution flows using the real Encore test DB.
 *
 * These tests focus on position limits and risk behavior without ever
 * hitting the real MEXC API. We do this by configuring the system so that
 * risk checks reject trades before the live execution path is reached.
 */

describe("Trade flow integration", () => {
  beforeEach(async () => {
    await BotDB.exec`DELETE FROM trades`;

    // Baseline config; individual tests will adjust as needed.
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

  it("rejects trades when 24h exposure exceeds max_position_usdt", async () => {
    // Configure system so that a new trade would push exposure over the limit,
    // and auto_trade=true so risk checks run full guardrails.
    await BotDB.exec`
      UPDATE trade_config
      SET max_trade_usdt = 1000.00,
          max_position_usdt = 150.00,
          auto_trade = true,
          high_value_threshold_usdt = 500.00,
          updated_at = NOW()
      WHERE id = 1
    `;

    // Seed existing live filled trades totalling 120 USDT exposure.
    await BotDB.exec`
      INSERT INTO trades (symbol, side, quote_qty, latency_ms, mode, status)
      VALUES
        ('AAAUSDT', 'BUY', 70.00, 10, 'live', 'filled'),
        ('BBBUSDT', 'BUY', 50.00, 20, 'live', 'filled')
    `;

    const req: TradeRequest = {
      symbol: "CCCUSDT",
      side: "buy",
      quoteQty: 50, // new exposure would be 170 > 150
    };

    const res = await executeTrade(req);

    expect(res.status).toBe("rejected");
    // Implementation records rejected trades as dry-run mode even when auto_trade=true.
    expect(res.mode).toBe("dry-run");
    expect(res.errorReason).toBe("exceeds_max_position_usdt");

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
    expect(row?.error_reason).toBe("exceeds_max_position_usdt");
  });
});
