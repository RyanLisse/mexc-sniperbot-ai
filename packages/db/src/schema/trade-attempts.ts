import {
  decimal,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const tradeAttempt = pgTable("trade_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingEventId: uuid("listing_event_id").notNull(),
  configurationId: uuid("configuration_id").notNull(),

  // Order Details
  symbol: text("symbol").notNull(),
  side: text("side").notNull().default("BUY"),
  type: text("type").notNull().default("MARKET"),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }),

  // Execution Results
  status: text("status").notNull().default("PENDING"),
  orderId: text("order_id"),
  executedQuantity: decimal("executed_quantity", { precision: 18, scale: 8 }),
  executedPrice: decimal("executed_price", { precision: 18, scale: 8 }),
  commission: decimal("commission", { precision: 18, scale: 8 }),

  // Encore-specific: MEXC order ID for tracking
  mexcOrderId: text("mexc_order_id"),

  // Timing Information
  detectedAt: timestamp("detected_at").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),

  // Encore-specific: Signal detection to order submission latency
  latencyMs: integer("latency_ms"), // detectedAt → submittedAt delta in milliseconds

  // Error Information
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),

  // Position Tracking
  parentTradeId: uuid("parent_trade_id"), // References parent buy order (for sell orders)
  positionId: uuid("position_id"), // Groups buy/sell pairs together
  sellReason: text("sell_reason"), // "PROFIT_TARGET", "STOP_LOSS", "TIME_BASED", "TRAILING_STOP", "MANUAL"

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  configurationSnapshot: jsonb("configuration_snapshot").notNull(),
});

export type TradeAttempt = typeof tradeAttempt.$inferSelect;
export type NewTradeAttempt = typeof tradeAttempt.$inferInsert;
