import { index } from "drizzle-orm/pg-core";
import { botStatus } from "./bot-status";
import { tradingConfiguration } from "./configuration";
import { listingEvent } from "./listing-events";
import { tradeAttempt } from "./trade-attempts";

/**
 * Database Indexes for Performance Optimization
 *
 * Purpose: Optimize query performance for high-frequency trading operations
 * Requirements: <50ms DB queries for sub-second trading performance
 */

// Listing Events Indexes
export const listingEventIndexes = {
  // Index for fast lookup by symbol (used in listing detection)
  symbolIdx: index("listing_events_symbol_idx").on(listingEvent.symbol),

  // Index for fast lookup by listing time (used for chronological queries)
  listingTimeIdx: index("listing_events_listing_time_idx").on(
    listingEvent.listingTime
  ),

  // Index for fast lookup by detected time (used for recent listings)
  detectedAtIdx: index("listing_events_detected_at_idx").on(
    listingEvent.detectedAt
  ),

  // Composite index for finding unprocessed listings by status
  statusProcessedIdx: index("listing_events_status_processed_idx").on(
    listingEvent.status,
    listingEvent.processed
  ),

  // Index for expiration cleanup queries
  expiresAtIdx: index("listing_events_expires_at_idx").on(
    listingEvent.expiresAt
  ),
};

// Trade Attempts Indexes
export const tradeAttemptIndexes = {
  // Index for fast lookup by symbol (used in trade history queries)
  symbolIdx: index("trade_attempts_symbol_idx").on(tradeAttempt.symbol),

  // Index for fast lookup by status (used for filtering by success/failure)
  statusIdx: index("trade_attempts_status_idx").on(tradeAttempt.status),

  // Index for chronological queries (most recent trades first)
  createdAtIdx: index("trade_attempts_created_at_idx").on(
    tradeAttempt.createdAt
  ),

  // Composite index for filtering by status and time
  statusCreatedAtIdx: index("trade_attempts_status_created_at_idx").on(
    tradeAttempt.status,
    tradeAttempt.createdAt
  ),

  // Index for finding trades by listing event
  listingEventIdIdx: index("trade_attempts_listing_event_id_idx").on(
    tradeAttempt.listingEventId
  ),

  // Index for finding trades by configuration
  configurationIdIdx: index("trade_attempts_configuration_id_idx").on(
    tradeAttempt.configurationId
  ),

  // Index for performance analysis queries (detection to execution time)
  detectedAtIdx: index("trade_attempts_detected_at_idx").on(
    tradeAttempt.detectedAt
  ),

  // Index for completed trades (used in statistics)
  completedAtIdx: index("trade_attempts_completed_at_idx").on(
    tradeAttempt.completedAt
  ),
};

// Bot Status Indexes
export const botStatusIndexes = {
  // Index for fast lookup of active bot status
  isRunningIdx: index("bot_status_is_running_idx").on(botStatus.isRunning),

  // Index for chronological queries (most recent status first)
  lastHeartbeatIdx: index("bot_status_last_heartbeat_idx").on(
    botStatus.lastHeartbeat
  ),

  // Index for cleanup queries
  updatedAtIdx: index("bot_status_updated_at_idx").on(botStatus.updatedAt),
};

// Trading Configuration Indexes
export const tradingConfigurationIndexes = {
  // Index for finding active configurations
  isActiveIdx: index("trading_configuration_is_active_idx").on(
    tradingConfiguration.isActive
  ),

  // Index for chronological queries
  createdAtIdx: index("trading_configuration_created_at_idx").on(
    tradingConfiguration.createdAt
  ),

  // Index for user lookups
  userIdIdx: index("trading_configuration_user_id_idx").on(
    tradingConfiguration.userId
  ),
};

/**
 * Index Usage Guidelines:
 *
 * 1. Listing Detection Queries:
 *    - Use symbolIdx for symbol-based lookups
 *    - Use statusProcessedIdx for finding unprocessed listings
 *    - Use detectedAtIdx for recent listings
 *
 * 2. Trade History Queries:
 *    - Use statusCreatedAtIdx for filtered chronological queries
 *    - Use symbolIdx for symbol-specific trade history
 *    - Use listingEventIdIdx for trades related to a specific listing
 *
 * 3. Performance Analysis:
 *    - Use detectedAtIdx and completedAtIdx for timing analysis
 *    - Use statusIdx for success/failure rate calculations
 *
 * 4. Bot Monitoring:
 *    - Use isRunningIdx for active bot checks
 *    - Use lastHeartbeatIdx for health monitoring
 *
 * 5. Configuration Management:
 *    - Use isActiveIdx for active configuration retrieval
 *    - Use versionIdx for configuration versioning
 *
 * Performance Targets:
 * - All indexed queries should complete in <50ms
 * - Composite indexes optimize multi-column WHERE clauses
 * - Index order matters: most selective columns first
 */

// Export all indexes together for schema migration
export const allIndexes = {
  listingEvents: listingEventIndexes,
  tradeAttempts: tradeAttemptIndexes,
  botStatus: botStatusIndexes,
  tradingConfiguration: tradingConfigurationIndexes,
};
