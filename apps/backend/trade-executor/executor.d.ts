import type { TradeRequest, TradeResponse } from "./types";
/**
 * Execute a trade with risk checks and dry-run/live mode support
 * User Story 2: Safe Auto-Trade Sniping
 */
export declare const executeTrade: (req: TradeRequest) => Promise<TradeResponse>;
