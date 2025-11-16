import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { BotDB } from "../db/db";


export interface RiskMetrics {
  totalExposure: number;
  activePositions: number;
  winRate: number;
  avgLatency: number;
  failedTrades: number;
  totalTrades: number;
  dailyPnL: number;
}

export const getRiskMetrics = api<void, RiskMetrics>(
  { method: "GET", path: "/risk/metrics", expose: true },
  async () => {
    const totalExposureResult = await BotDB.queryRow<{ total: number }>`
      SELECT COALESCE(SUM(total_value), 0) as total
      FROM trades
      WHERE status = 'executed' AND side = 'buy'
    `;

    const activePositionsResult = await BotDB.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT symbol)::int as count
      FROM trades
      WHERE status = 'executed' AND side = 'buy'
    `;

    const tradeStatsResult = await BotDB.queryRow<{
      total: number;
      executed: number;
      failed: number;
      avg_latency: number;
    }>`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'executed' THEN 1 END)::int as executed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed,
        AVG(latency_ms)::int as avg_latency
      FROM trades
    `;

    const winRate = tradeStatsResult && tradeStatsResult.total > 0
      ? (tradeStatsResult.executed / tradeStatsResult.total) * 100
      : 0;

    return {
      totalExposure: totalExposureResult?.total || 0,
      activePositions: activePositionsResult?.count || 0,
      winRate,
      avgLatency: tradeStatsResult?.avg_latency || 0,
      failedTrades: tradeStatsResult?.failed || 0,
      totalTrades: tradeStatsResult?.total || 0,
      dailyPnL: 0,
    };
  }
);

export interface ValidateTradeRequest {
  symbol: string;
  quantity: number;
  price: number;
}

export interface ValidateTradeResponse {
  approved: boolean;
  reason?: string;
  adjustedQuantity?: number;
}

export const validateTrade = api<ValidateTradeRequest, ValidateTradeResponse>(
  { method: "POST", path: "/risk/validate", expose: true },
  async (req) => {
    const config = await BotDB.queryRow<{
      max_position_size: number;
      max_trade_amount: number;
      risk_per_trade: number;
      enabled: boolean;
    }>`
      SELECT max_position_size, max_trade_amount, risk_per_trade, enabled
      FROM trade_config
      WHERE id = 1
    `;

    if (!config?.enabled) {
      return { approved: false, reason: "Trading is disabled" };
    }

    const tradeValue = req.quantity * req.price;

    if (tradeValue > config.max_trade_amount) {
      const adjustedQuantity = config.max_trade_amount / req.price;
      return {
        approved: true,
        reason: "Trade size adjusted to max limit",
        adjustedQuantity,
      };
    }

    const currentExposure = await BotDB.queryRow<{ total: number }>`
      SELECT COALESCE(SUM(total_value), 0) as total
      FROM trades
      WHERE status = 'executed' AND side = 'buy'
    `;

    if ((currentExposure?.total || 0) + tradeValue > config.max_position_size) {
      return {
        approved: false,
        reason: "Trade would exceed maximum position size",
      };
    }

    return { approved: true };
  }
);
