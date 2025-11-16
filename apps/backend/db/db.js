import { SQLDatabase } from "encore.dev/storage/sqldb";
export const BotDB = new SQLDatabase("crypto-bot", {
    migrations: "./migrations",
});
//# sourceMappingURL=db.js.map