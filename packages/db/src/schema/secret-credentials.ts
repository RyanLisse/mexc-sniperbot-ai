import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const secretCredential = pgTable("secret_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Environment Scope
  environment: text("environment").notNull(), // "local" | "dev" | "prod"

  // Validation Status
  validatedAt: timestamp("validated_at"),
  lastError: text("last_error"),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SecretCredential = typeof secretCredential.$inferSelect;
export type NewSecretCredential = typeof secretCredential.$inferInsert;
