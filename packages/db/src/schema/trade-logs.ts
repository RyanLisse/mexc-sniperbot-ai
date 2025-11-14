import { decimal, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const tradeLog = pgTable("trade_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(), // FK to trade_attempts.id

  // Immutable Exchange Response
  exchangeResponse: jsonb("exchange_response").notNull(), // Full MEXC API response

  // Fill Details
  fillQuantity: decimal("fill_quantity", { precision: 18, scale: 8 }).notNull(),
  fillPrice: decimal("fill_price", { precision: 18, scale: 8 }).notNull(),

  // Fees
  fees: jsonb("fees").notNull(), // Fee breakdown from exchange

  // Portfolio Snapshot (optional)
  positionSnapshot: jsonb("position_snapshot"),

  // Metadata
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
});

export type TradeLog = typeof tradeLog.$inferSelect;
export type NewTradeLog = typeof tradeLog.$inferInsert;
