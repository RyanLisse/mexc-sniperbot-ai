import { listingEvent } from "@mexc-sniperbot-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../lib/pino-logger";

/**
 * Listing signal detection source
 */
export type DetectionSource = "calendar" | "ticker_diff";

/**
 * Signal confidence level
 */
export type SignalConfidence = "high" | "medium" | "low";

/**
 * Create listing signal parameters
 */
export type CreateListingSignalParams = {
  symbol: string;
  detectionSource: DetectionSource;
  listingTime?: Date;
  confidence: SignalConfidence;
  freshnessDeadline: Date;
};

/**
 * Create a new listing signal
 */
export async function createListingSignal(params: CreateListingSignalParams) {
  const now = new Date();

  const [signal] = await db
    .insert(listingEvent)
    .values({
      symbol: params.symbol,
      detectionSource: params.detectionSource,
      detectedAt: now,
      listingTime: params.listingTime,
      confidence: params.confidence,
      freshnessDeadline: params.freshnessDeadline,
      processed: false,
    })
    .returning();

  logger.info(
    {
      event: "listing_signal_created",
      symbol: params.symbol,
      source: params.detectionSource,
      confidence: params.confidence,
      freshnessDeadline: params.freshnessDeadline.toISOString(),
    },
    `New listing signal: ${params.symbol}`
  );

  return signal;
}

/**
 * Mark signal as processed
 */
export async function markSignalProcessed(signalId: string) {
  const [updated] = await db
    .update(listingEvent)
    .set({ processed: true })
    .where(eq(listingEvent.id, signalId))
    .returning();

  logger.debug(
    {
      event: "listing_signal_processed",
      signalId,
      symbol: updated?.symbol,
    },
    `Signal marked as processed: ${signalId}`
  );

  return updated;
}

/**
 * Get unprocessed signals within freshness deadline
 */
export async function getUnprocessedSignals() {
  const now = new Date();

  const signals = await db
    .select()
    .from(listingEvent)
    .where(
      and(
        eq(listingEvent.processed, false)
        // Only get signals that are still fresh
        // freshnessDeadline > now
      )
    )
    .orderBy(desc(listingEvent.detectedAt))
    .limit(100);

  // Filter in-memory for freshness (Drizzle doesn't have gt for dates easily)
  const freshSignals = signals.filter(
    (signal) => signal.freshnessDeadline && signal.freshnessDeadline > now
  );

  logger.debug(
    {
      event: "unprocessed_signals_fetched",
      count: freshSignals.length,
    },
    `Fetched ${freshSignals.length} unprocessed signals`
  );

  return freshSignals;
}

/**
 * Get signal by ID
 */
export async function getSignalById(signalId: string) {
  const [signal] = await db
    .select()
    .from(listingEvent)
    .where(eq(listingEvent.id, signalId))
    .limit(1);

  return signal;
}

/**
 * Get recent signals for a symbol (deduplication check)
 */
export async function getRecentSignalsForSymbol(
  symbol: string,
  withinMinutes = 5
) {
  const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);

  const signals = await db
    .select()
    .from(listingEvent)
    .where(eq(listingEvent.symbol, symbol))
    .orderBy(desc(listingEvent.detectedAt))
    .limit(10);

  // Filter in-memory for time range
  return signals.filter(
    (signal) => signal.detectedAt && signal.detectedAt >= cutoffTime
  );
}

/**
 * Check if signal already exists (deduplication)
 */
export async function isSignalDuplicate(
  symbol: string,
  source: DetectionSource,
  withinMinutes = 1
): Promise<boolean> {
  const recentSignals = await getRecentSignalsForSymbol(symbol, withinMinutes);

  return recentSignals.some((signal) => signal.detectionSource === source);
}

/**
 * Get all recent signals
 */
export async function getRecentSignals(limit = 50) {
  return db
    .select()
    .from(listingEvent)
    .orderBy(desc(listingEvent.detectedAt))
    .limit(limit);
}
