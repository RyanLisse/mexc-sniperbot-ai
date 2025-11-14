import {
  boolean,
  decimal,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const listingEvent = pgTable("listing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull(),
  exchangeName: text("exchange_name").notNull().default("MEXC"),

  // Listing Details
  listingTime: timestamp("listing_time").notNull(),
  baseAsset: text("base_asset").notNull(),
  quoteAsset: text("quote_asset").notNull(),
  status: text("status").notNull().default("DETECTED"),

  // Calendar-specific fields (optional for backward compatibility)
  vcoinId: text("vcoin_id"), // MEXC calendar vcoinId for tracking across symbol changes
  projectName: text("project_name"), // Full project name from calendar (vcoinNameFull)
  detectionMethod: text("detection_method").default("SYMBOL_COMPARISON"), // "CALENDAR" | "SYMBOL_COMPARISON"

  // Encore-specific: Signal confidence scoring
  confidence: text("confidence").default("high"), // "high" | "medium" | "low"

  // Encore-specific: Freshness deadline for order execution
  freshnessDeadline: timestamp("freshness_deadline"), // After this, signal is stale

  // Market Data
  initialPrice: decimal("initial_price", { precision: 18, scale: 8 }),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
  priceChange24h: decimal("price_change_24h", { precision: 8, scale: 4 }),

  // Processing State
  processed: boolean("processed").notNull().default(false),
  tradeAttemptId: uuid("trade_attempt_id"),

  // Metadata
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type ListingEvent = typeof listingEvent.$inferSelect;
export type NewListingEvent = typeof listingEvent.$inferInsert;
