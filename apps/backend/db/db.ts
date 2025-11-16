import { SQLDatabase } from "encore.dev/storage/sqldb";

export const BotDB = new SQLDatabase("crypto-bot", {
  migrations: "./migrations",
});

export type BotDatabase = typeof BotDB;
