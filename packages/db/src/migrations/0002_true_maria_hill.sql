CREATE TABLE "bot_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuration_id" uuid NOT NULL,
	"status" text DEFAULT 'starting' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"stopped_at" timestamp,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"operator_id" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"exchange_response" jsonb NOT NULL,
	"fill_quantity" numeric(18, 8) NOT NULL,
	"fill_price" numeric(18, 8) NOT NULL,
	"fees" jsonb NOT NULL,
	"position_snapshot" jsonb,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"validated_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "recv_window" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "profit_target_percent" integer DEFAULT 500;--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "stop_loss_percent" integer DEFAULT 200;--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "time_based_exit_minutes" integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "trailing_stop_percent" integer;--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "sell_strategy" text DEFAULT 'COMBINED';--> statement-breakpoint
ALTER TABLE "trading_configurations" ADD COLUMN "safety_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_events" ADD COLUMN "vcoin_id" text;--> statement-breakpoint
ALTER TABLE "listing_events" ADD COLUMN "project_name" text;--> statement-breakpoint
ALTER TABLE "listing_events" ADD COLUMN "detection_method" text DEFAULT 'SYMBOL_COMPARISON';--> statement-breakpoint
ALTER TABLE "listing_events" ADD COLUMN "confidence" text DEFAULT 'high';--> statement-breakpoint
ALTER TABLE "listing_events" ADD COLUMN "freshness_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "trade_attempts" ADD COLUMN "mexc_order_id" text;--> statement-breakpoint
ALTER TABLE "trade_attempts" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "trade_attempts" ADD COLUMN "parent_trade_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_attempts" ADD COLUMN "position_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_attempts" ADD COLUMN "sell_reason" text;