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

// Plain TS shapes used throughout the app and understood by Encore's TS parser
export type BotRun = {
  id: string;
  configurationId: string;
  status: string;
  startedAt: Date;
  stoppedAt: Date | null;
  lastHeartbeat: Date;
  operatorId: string;
  errorMessage: string | null;
  createdAt: Date;
};

export type NewBotRun = {
  configurationId: string;
  operatorId: string;
  status?: string;
  startedAt?: Date;
  stoppedAt?: Date | null;
  lastHeartbeat?: Date;
  errorMessage?: string | null;
  createdAt?: Date;
};
