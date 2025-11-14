import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { botStatus } from "./schema/bot-status";
// Import schema for internal database connection
import { tradingConfiguration } from "./schema/configuration";
import { listingEvent } from "./schema/listing-events";
import { tradeAttempt } from "./schema/trade-attempts";
import { userSession } from "./schema/user-sessions";
// Encore-specific tables
import { botRun } from "./schema/bot-runs";
import { tradeLog } from "./schema/trade-logs";
import { secretCredential } from "./schema/secret-credentials";

// Database connection with full schema
export const db = drizzle(process.env.DATABASE_URL || "", {
  schema: {
    tradingConfiguration,
    listingEvent,
    tradeAttempt,
    botStatus,
    userSession,
    botRun,
    tradeLog,
    secretCredential,
  },
});

// Schema object for internal use
export const schema = {
  tradingConfiguration,
  listingEvent,
  tradeAttempt,
  botStatus,
  userSession,
  botRun,
  tradeLog,
  secretCredential,
};

export { type BotRun, botRun, type NewBotRun } from "./schema/bot-runs";
// Re-export schema items using export from pattern
// biome-ignore lint/performance/noBarrelFile: Database package needs centralized exports
export { botStatus } from "./schema/bot-status";
export {
  type NewTradingConfiguration,
  type TradingConfiguration,
  tradingConfiguration,
} from "./schema/configuration";
export {
  type ListingEvent,
  listingEvent,
  type NewListingEvent,
} from "./schema/listing-events";
export {
  type NewSecretCredential,
  type SecretCredential,
  secretCredential,
} from "./schema/secret-credentials";
export {
  type NewTradeAttempt,
  type TradeAttempt,
  tradeAttempt,
} from "./schema/trade-attempts";
export { type NewTradeLog, type TradeLog, tradeLog } from "./schema/trade-logs";
export { userSession } from "./schema/user-sessions";

// Migration function for programmatic migrations
export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Database migration failed:", error);
    throw error;
  }
}
