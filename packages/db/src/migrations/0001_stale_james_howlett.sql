ALTER TABLE "user_sessions" ADD COLUMN "refresh_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "refresh_expires_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token");