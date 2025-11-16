import log from "encore.dev/log";
import { BotDB } from "../db/db";
import { recordRiskRejection } from "../metrics/trade-metrics";

const GLOBAL_MAX_TRADE_USDT = 10;

/**
 * Risk check result
 */
export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
}

/**
 * Trade parameters for risk validation
 */
export interface TradeParams {
  symbol: string;
  quoteQty: number;
}

/**
 * Apply risk checks before trade execution
 * Enforces User Story 2 guardrails:
 * - max_trade_usdt limit
 * - max_position_usdt limit
 * - auto_trade flag
 */
export async function checkTradeRisk(params: TradeParams): Promise<RiskCheckResult> {
  try {
    const config = await BotDB.queryRow<{
      max_trade_usdt: number;
      max_position_usdt: number;
      auto_trade: boolean;
    }>`
      SELECT max_trade_usdt, max_position_usdt, auto_trade
      FROM trade_config WHERE id = 1
    `;

    if (!config) {
      return {
        approved: false,
        reason: "trade_config_missing",
      };
    }

    // Check 1: Global per-trade hard cap (safety net for all trades)
    if (params.quoteQty > GLOBAL_MAX_TRADE_USDT) {
      log.info("Trade rejected: exceeds global max_trade_usdt", {
        symbol: params.symbol,
        quoteQty: params.quoteQty,
        globalMaxTradeUsdt: GLOBAL_MAX_TRADE_USDT,
      });
      recordRiskRejection("exceeds_global_max_trade_usdt");
      return {
        approved: false,
        reason: "exceeds_global_max_trade_usdt",
      };
    }

    // Check 2: Auto-trade must be enabled for live trades
    if (!config.auto_trade) {
      log.info("Trade rejected: auto_trade disabled (dry-run mode)", { symbol: params.symbol });
      recordRiskRejection("auto_trade_disabled");
      return {
        approved: false,
        reason: "auto_trade_disabled",
      };
    }

    // Check 3: Single trade limit (config-driven)
    if (params.quoteQty > config.max_trade_usdt) {
      log.info("Trade rejected: exceeds max_trade_usdt", {
        symbol: params.symbol,
        quoteQty: params.quoteQty,
        maxTradeUsdt: config.max_trade_usdt,
      });
      recordRiskRejection("exceeds_max_trade_usdt");
      return {
        approved: false,
        reason: "exceeds_max_trade_usdt",
      };
    }

    // Check 4: Total position limit (24h rolling exposure)
    const totalExposure = await BotDB.queryRow<{ total: number }>`
      SELECT COALESCE(SUM(quote_qty), 0) as total
      FROM trades
      WHERE mode = 'live' 
      AND status = 'filled'
      AND created_at > NOW() - INTERVAL '24 hours'
    `;

    const newTotalExposure = (totalExposure?.total || 0) + params.quoteQty;

    if (newTotalExposure > config.max_position_usdt) {
      log.info("Trade rejected: exceeds max_position_usdt", {
        symbol: params.symbol,
        currentExposure: totalExposure?.total,
        newTotal: newTotalExposure,
        maxPositionUsdt: config.max_position_usdt,
      });
      recordRiskRejection("exceeds_max_position_usdt");
      return {
        approved: false,
        reason: "exceeds_max_position_usdt",
      };
    }

    // All checks passed
    return {
      approved: true,
    };
  } catch (error) {
    log.error("Risk check failed with error", { error, params });
    return {
      approved: false,
      reason: "risk_check_error",
    };
  }
}
