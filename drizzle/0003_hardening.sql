CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"resets_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cleaning_takeover" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "booking_user_idx" ON "booking" USING btree ("user_id","ends_at");--> statement-breakpoint
CREATE INDEX "booking_household_idx" ON "booking" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
-- Hand-written from here on: rules the settings screen already enforces, repeated
-- where no code path can get around them.
ALTER TABLE "resource" ADD CONSTRAINT "resource_slot_positive" CHECK ("slot_minutes" > 0);
--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_hours_in_order" CHECK ("opens_at" >= 0 AND "closes_at" <= 1440 AND "closes_at" > "opens_at");
--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_limits_sane" CHECK ("max_per_day" >= 1 AND "book_ahead_days" >= 0);
--> statement-breakpoint
ALTER TABLE "cleaning_area" ADD CONSTRAINT "cleaning_area_interval_positive" CHECK ("interval_days" > 0);
