import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const tradingConfiguration = pgTable('trading_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  
  // Trading Parameters
  enabledPairs: text('enabled_pairs').array().notNull().default([]),
  maxPurchaseAmount: integer('max_purchase_amount').notNull(),
  priceTolerance: integer('price_tolerance').notNull(), // stored as basis points (100 = 1%)
  
  // Risk Management
  dailySpendingLimit: integer('daily_spending_limit').notNull(),
  maxTradesPerHour: integer('max_trades_per_hour').notNull(),
  
  // Timing Configuration
  pollingInterval: integer('polling_interval').notNull().default(5000), // milliseconds
  orderTimeout: integer('order_timeout').notNull().default(10000), // milliseconds
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export type TradingConfiguration = typeof tradingConfiguration.$inferSelect;
export type NewTradingConfiguration = typeof tradingConfiguration.$inferInsert;
