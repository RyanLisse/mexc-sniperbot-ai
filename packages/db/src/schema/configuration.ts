import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const tradingConfiguration = pgTable("trading_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),

  // Trading Parameters
  enabledPairs: text("enabled_pairs").array().notNull().default([]),
  maxPurchaseAmount: integer("max_purchase_amount").notNull(),
  priceTolerance: integer("price_tolerance").notNull(), // stored as basis points (100 = 1%)

  // Risk Management
  dailySpendingLimit: integer("daily_spending_limit").notNull(),
  maxTradesPerHour: integer("max_trades_per_hour").notNull(),

  // Timing Configuration
  pollingInterval: integer("polling_interval").notNull().default(5000), // milliseconds
  orderTimeout: integer("order_timeout").notNull().default(10_000), // milliseconds

  // Encore-specific: MEXC API recvWindow for order staleness check
  recvWindow: integer("recv_window").notNull().default(1000), // milliseconds, max 1000 per MEXC docs

  // Sell Strategy Configuration
  profitTargetPercent: integer("profit_target_percent").default(500), // basis points (500 = 5%)
  stopLossPercent: integer("stop_loss_percent").default(200), // basis points (200 = 2%)
  timeBasedExitMinutes: integer("time_based_exit_minutes").default(60), // minutes
  trailingStopPercent: integer("trailing_stop_percent"), // basis points (optional)
  sellStrategy: text("sell_strategy").default("COMBINED"), // "PROFIT_TARGET", "STOP_LOSS", "TIME_BASED", "TRAILING_STOP", "COMBINED"

  // Encore-specific: Safety master switch
  safetyEnabled: boolean("safety_enabled").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

// Plain TS shapes used by Encore and the app
export type TradingConfiguration = {
  id: string;
  userId: string;
  enabledPairs: string[];
  maxPurchaseAmount: number;
  priceTolerance: number;
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval: number;
  orderTimeout: number;
  recvWindow: number;
  profitTargetPercent: number | null;
  stopLossPercent: number | null;
  timeBasedExitMinutes: number | null;
  trailingStopPercent: number | null;
  sellStrategy: string | null;
  safetyEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};

export type NewTradingConfiguration = {
  userId: string;
  enabledPairs?: string[];
  maxPurchaseAmount: number;
  priceTolerance: number;
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval?: number;
  orderTimeout?: number;
  recvWindow?: number;
  profitTargetPercent?: number | null;
  stopLossPercent?: number | null;
  timeBasedExitMinutes?: number | null;
  trailingStopPercent?: number | null;
  sellStrategy?: string | null;
  safetyEnabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
};

export type {
  TradingConfiguration as BotConfiguration,
  NewTradingConfiguration as NewBotConfiguration,
};
