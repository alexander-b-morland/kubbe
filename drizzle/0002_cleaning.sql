CREATE TABLE "cleaning_area" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"interval_days" integer NOT NULL,
	"estimate_minutes" integer NOT NULL,
	"start_day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaning_done" (
	"area_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"done_by" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleaning_done_area_id_period_pk" PRIMARY KEY("area_id","period")
);
--> statement-breakpoint
CREATE TABLE "cleaning_takeover" (
	"area_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "cleaning_takeover_area_id_period_pk" PRIMARY KEY("area_id","period")
);
--> statement-breakpoint
ALTER TABLE "cleaning_area" ADD CONSTRAINT "cleaning_area_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_done" ADD CONSTRAINT "cleaning_done_area_id_cleaning_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."cleaning_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_done" ADD CONSTRAINT "cleaning_done_done_by_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_takeover" ADD CONSTRAINT "cleaning_takeover_area_id_cleaning_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."cleaning_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_takeover" ADD CONSTRAINT "cleaning_takeover_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleaning_area_household_idx" ON "cleaning_area" USING btree ("household_id");