import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { botStatus } from "./schema/bot-status";
// Import schema for internal database connection
import { tradingConfiguration } from "./schema/configuration";
import { listingEvent } from "./schema/listing-events";
import { tradeAttempt } from "./schema/trade-attempts";
import { userSession } from "./schema/user-sessions";

// Database connection with full schema
export const db = drizzle(process.env.DATABASE_URL || "", {
  schema: {
    tradingConfiguration,
    listingEvent,
    tradeAttempt,
    botStatus,
    userSession,
  },
});

// Schema object for internal use
export const schema = {
  tradingConfiguration,
  listingEvent,
  tradeAttempt,
  botStatus,
  userSession,
};

// Re-export schema items using export from pattern
// biome-ignore lint/performance/noBarrelFile: Database package needs centralized exports
export { botStatus } from "./schema/bot-status";
export { tradingConfiguration } from "./schema/configuration";
export { listingEvent } from "./schema/listing-events";
export { tradeAttempt } from "./schema/trade-attempts";
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
