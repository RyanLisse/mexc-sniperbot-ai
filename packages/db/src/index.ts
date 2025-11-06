import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Import schema from individual files
import { tradingConfiguration } from "./schema/configuration";
import { listingEvent } from "./schema/listing-events";
import { tradeAttempt } from "./schema/trade-attempts";
import { botStatus } from "./schema/bot-status";
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

// Export specific schema types and tables
export {
  tradingConfiguration,
  listingEvent,
  tradeAttempt,
  botStatus,
  userSession,
};

// Schema object for internal use
export const schema = {
  tradingConfiguration,
  listingEvent,
  tradeAttempt,
  botStatus,
  userSession,
};

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
