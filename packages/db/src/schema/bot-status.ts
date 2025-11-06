import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const botStatus = pgTable("bot_status", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Operational State
  isRunning: boolean("is_running").notNull().default(false),
  lastHeartbeat: timestamp("last_heartbeat").notNull().defaultNow(),

  // API Connectivity
  mexcApiStatus: text("mexc_api_status").notNull().default("UNKNOWN"),
  lastApiCheck: timestamp("last_api_check").notNull().defaultNow(),
  apiResponseTime: integer("api_response_time").notNull(), // milliseconds

  // Performance Metrics
  listingsDetected24h: integer("listings_detected_24h").notNull().default(0),
  tradesExecuted24h: integer("trades_executed_24h").notNull().default(0),
  averageExecutionTime: integer("average_execution_time").notNull(), // milliseconds

  // Error Tracking
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),

  // Configuration
  currentConfigurationId: uuid("current_configuration_id").notNull(),
  configurationVersion: integer("configuration_version").notNull().default(1),

  // Metadata
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotStatus = typeof botStatus.$inferSelect;
export type NewBotStatus = typeof botStatus.$inferInsert;
