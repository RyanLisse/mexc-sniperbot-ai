import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const botRun = pgTable("bot_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  configurationId: uuid("configuration_id").notNull(),

  // Run Status
  status: text("status").notNull().default("starting"), // "starting" | "running" | "stopping" | "stopped" | "failed"

  // Lifecycle Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  stoppedAt: timestamp("stopped_at"),
  lastHeartbeat: timestamp("last_heartbeat").notNull().defaultNow(),

  // Operator Information
  operatorId: text("operator_id").notNull(),

  // Error Information
  errorMessage: text("error_message"),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BotRun = typeof botRun.$inferSelect;
export type NewBotRun = typeof botRun.$inferInsert;
