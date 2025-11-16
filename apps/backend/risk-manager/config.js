import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { BotDB } from "../db/db";
import { recordAutoTradeMode, recordConfigUpdate } from "../metrics/trade-metrics";
export const getConfig = api({ method: "GET", path: "/config", expose: true, auth: false }, async () => {
    const config = await BotDB.queryRow `
      SELECT max_trade_usdt, max_position_usdt, auto_trade, 
             high_value_threshold_usdt, created_at, updated_at 
      FROM trade_config WHERE id = 1
    `;
    if (!config) {
        throw new Error("Config not found - run database migrations");
    }
    log.info("Configuration retrieved", { config });
    // Update auto-trade mode metric
    recordAutoTradeMode(config.auto_trade);
    return {
        maxTradeUsdt: config.max_trade_usdt,
        maxPositionUsdt: config.max_position_usdt,
        autoTrade: config.auto_trade,
        highValueThresholdUsdt: config.high_value_threshold_usdt,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
    };
});
export const updateConfig = api({ method: "PUT", path: "/config", expose: true, auth: false }, async (req) => {
    // Validate constraints before update
    if (req.maxTradeUsdt !== undefined && req.maxTradeUsdt <= 0) {
        throw new Error("max_trade_usdt must be positive");
    }
    if (req.maxPositionUsdt !== undefined && req.maxTradeUsdt !== undefined) {
        if (req.maxPositionUsdt < req.maxTradeUsdt) {
            throw new Error("max_position_usdt must be >= max_trade_usdt");
        }
    }
    // Build dynamic SQL for only provided fields
    const updates = [];
    const params = [];
    if (req.maxTradeUsdt !== undefined) {
        params.push(req.maxTradeUsdt);
        updates.push(`max_trade_usdt = $${params.length}`);
    }
    if (req.maxPositionUsdt !== undefined) {
        params.push(req.maxPositionUsdt);
        updates.push(`max_position_usdt = $${params.length}`);
    }
    if (req.autoTrade !== undefined) {
        params.push(req.autoTrade);
        updates.push(`auto_trade = $${params.length}`);
    }
    if (req.highValueThresholdUsdt !== undefined) {
        params.push(req.highValueThresholdUsdt);
        updates.push(`high_value_threshold_usdt = $${params.length}`);
    }
    if (updates.length > 0) {
        // Note: Using template literals for dynamic SQL with validated inputs
        const sql = `UPDATE trade_config SET ${updates.join(", ")}, updated_at = NOW() WHERE id = 1`;
        await BotDB.rawExec(sql, ...params);
        // Record configuration update metric
        recordConfigUpdate();
    }
    // Return updated config
    return getConfig();
});
//# sourceMappingURL=config.js.map