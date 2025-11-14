-- Complete Database Schema for MEXC Sniper Bot
-- Run this in Supabase SQL Editor if tables don't exist

-- Bot Status Table
CREATE TABLE IF NOT EXISTS "bot_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_running" boolean DEFAULT false NOT NULL,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"mexc_api_status" text DEFAULT 'UNKNOWN' NOT NULL,
	"last_api_check" timestamp DEFAULT now() NOT NULL,
	"api_response_time" integer NOT NULL,
	"listings_detected_24h" integer DEFAULT 0 NOT NULL,
	"trades_executed_24h" integer DEFAULT 0 NOT NULL,
	"average_execution_time" integer NOT NULL,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"last_error_at" timestamp,
	"last_error_message" text,
	"current_configuration_id" uuid NOT NULL,
	"configuration_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Trading Configurations Table
CREATE TABLE IF NOT EXISTS "trading_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled_pairs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"max_purchase_amount" integer NOT NULL,
	"price_tolerance" integer NOT NULL,
	"daily_spending_limit" integer NOT NULL,
	"max_trades_per_hour" integer NOT NULL,
	"polling_interval" integer DEFAULT 5000 NOT NULL,
	"order_timeout" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);

-- Listing Events Table
CREATE TABLE IF NOT EXISTS "listing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"exchange_name" text DEFAULT 'MEXC' NOT NULL,
	"listing_time" timestamp NOT NULL,
	"base_asset" text NOT NULL,
	"quote_asset" text NOT NULL,
	"status" text DEFAULT 'DETECTED' NOT NULL,
	"initial_price" numeric(18, 8),
	"current_price" numeric(18, 8),
	"price_change_24h" numeric(8, 4),
	"processed" boolean DEFAULT false NOT NULL,
	"trade_attempt_id" uuid,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);

-- Trade Attempts Table
CREATE TABLE IF NOT EXISTS "trade_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_event_id" uuid NOT NULL,
	"configuration_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" text DEFAULT 'BUY' NOT NULL,
	"type" text DEFAULT 'MARKET' NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"price" numeric(18, 8),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"order_id" text,
	"executed_quantity" numeric(18, 8),
	"executed_price" numeric(18, 8),
	"commission" numeric(18, 8),
	"detected_at" timestamp NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_code" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"configuration_snapshot" jsonb NOT NULL
);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"login_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token")
);

-- Todo Table (Example)
CREATE TABLE IF NOT EXISTS "todo" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS "listing_events_symbol_idx" ON "listing_events" ("symbol");
CREATE INDEX IF NOT EXISTS "listing_events_listing_time_idx" ON "listing_events" ("listing_time");
CREATE INDEX IF NOT EXISTS "listing_events_detected_at_idx" ON "listing_events" ("detected_at");
CREATE INDEX IF NOT EXISTS "listing_events_status_processed_idx" ON "listing_events" ("status", "processed");
CREATE INDEX IF NOT EXISTS "listing_events_expires_at_idx" ON "listing_events" ("expires_at");

CREATE INDEX IF NOT EXISTS "trade_attempts_symbol_idx" ON "trade_attempts" ("symbol");
CREATE INDEX IF NOT EXISTS "trade_attempts_status_idx" ON "trade_attempts" ("status");
CREATE INDEX IF NOT EXISTS "trade_attempts_created_at_idx" ON "trade_attempts" ("created_at");
CREATE INDEX IF NOT EXISTS "trade_attempts_status_created_at_idx" ON "trade_attempts" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "trade_attempts_listing_event_id_idx" ON "trade_attempts" ("listing_event_id");
CREATE INDEX IF NOT EXISTS "trade_attempts_configuration_id_idx" ON "trade_attempts" ("configuration_id");
CREATE INDEX IF NOT EXISTS "trade_attempts_detected_at_idx" ON "trade_attempts" ("detected_at");
CREATE INDEX IF NOT EXISTS "trade_attempts_completed_at_idx" ON "trade_attempts" ("completed_at");

CREATE INDEX IF NOT EXISTS "bot_status_is_running_idx" ON "bot_status" ("is_running");
CREATE INDEX IF NOT EXISTS "bot_status_last_heartbeat_idx" ON "bot_status" ("last_heartbeat");
CREATE INDEX IF NOT EXISTS "bot_status_updated_at_idx" ON "bot_status" ("updated_at");

CREATE INDEX IF NOT EXISTS "trading_configuration_is_active_idx" ON "trading_configurations" ("is_active");
CREATE INDEX IF NOT EXISTS "trading_configuration_created_at_idx" ON "trading_configurations" ("created_at");
CREATE INDEX IF NOT EXISTS "trading_configuration_user_id_idx" ON "trading_configurations" ("user_id");

