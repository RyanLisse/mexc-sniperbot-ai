import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/web/.env.local",
});

export default defineConfig({
  schema: [
    "./src/schema/bot-status.ts",
    "./src/schema/configuration.ts",
    "./src/schema/listing-events.ts",
    "./src/schema/todo.ts",
    "./src/schema/trade-attempts.ts",
    "./src/schema/user-sessions.ts",
    // Encore-specific tables
    "./src/schema/bot-runs.ts",
    "./src/schema/trade-logs.ts",
    "./src/schema/secret-credentials.ts",
  ],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
    ssl: { rejectUnauthorized: false },
  },
});
