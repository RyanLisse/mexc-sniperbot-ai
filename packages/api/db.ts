import { db as drizzleDb } from "@mexc-sniperbot-ai/db";
import { SQLDatabase } from "encore.dev/storage/sqldb";

export const BotDB = new SQLDatabase("botdb", {
  migrations: "./migrations",
});

export const db = drizzleDb;
