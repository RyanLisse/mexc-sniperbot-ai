import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";

// Database connection with full schema
export const db = drizzle(process.env.DATABASE_URL || "", {
  schema,
});

// Export all schema types and tables
export * from "./schema";
export { schema };

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
