CREATE TABLE "bot_status" (
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
--> statement-breakpoint
CREATE TABLE "trading_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled_pairs" text[] DEFAULT '{}' NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "listing_events" (
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
--> statement-breakpoint
CREATE TABLE "trade_attempts" (
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
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"login_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "todo" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
