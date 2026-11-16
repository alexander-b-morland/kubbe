CREATE TYPE "public"."resource_kind" AS ENUM('shower', 'washer', 'dryer');--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"slot_minutes" integer NOT NULL,
	"opens_at" integer NOT NULL,
	"closes_at" integer NOT NULL,
	"max_per_day" integer NOT NULL,
	"allow_back_to_back" boolean DEFAULT false NOT NULL,
	"book_ahead_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_resource_time_idx" ON "booking" USING btree ("resource_id","starts_at");--> statement-breakpoint
CREATE INDEX "resource_household_idx" ON "resource" USING btree ("household_id");--> statement-breakpoint
-- Hand-written from here on: Drizzle cannot express these.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_ends_after_start" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
-- The last line of defence against double booking: no two bookings of the
-- same resource may overlap in time, whatever the application does.
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist ("resource_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&);
--> statement-breakpoint
-- Households created before booking existed get the default resources.
INSERT INTO "resource" ("household_id", "kind", "name", "enabled", "slot_minutes", "opens_at", "closes_at", "max_per_day", "allow_back_to_back", "book_ahead_days")
SELECT h."id", d."kind"::resource_kind, d."name", d."enabled", d."slot_minutes", d."opens_at", d."closes_at", d."max_per_day", false, 7
FROM "household" h
CROSS JOIN (VALUES
  ('shower', 'Shower', true, 20, 360, 1380, 3),
  ('washer', 'Washing machine', true, 120, 420, 1380, 2),
  ('dryer', 'Dryer', false, 120, 420, 1380, 2)
) AS d("kind", "name", "enabled", "slot_minutes", "opens_at", "closes_at", "max_per_day")
WHERE NOT EXISTS (SELECT 1 FROM "resource" r WHERE r."household_id" = h."id");
