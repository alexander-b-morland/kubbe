CREATE TABLE "dinner_reply" (
	"dinner_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"going" boolean NOT NULL,
	CONSTRAINT "dinner_reply_dinner_id_user_id_pk" PRIMARY KEY("dinner_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "from_helper" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "dinner_reply" ADD CONSTRAINT "dinner_reply_dinner_id_dinner_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_reply" ADD CONSTRAINT "dinner_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Dinners used to be opt-out: keep the answers people already gave.
INSERT INTO "dinner_reply" ("dinner_id", "user_id", "going") SELECT "dinner_id", "user_id", false FROM "dinner_absence" ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Whoever was cooking or cleaning up was in.
INSERT INTO "dinner_reply" ("dinner_id", "user_id", "going") SELECT "id", "cook_id", true FROM "dinner" WHERE "cook_id" IS NOT NULL ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "dinner_reply" ("dinner_id", "user_id", "going") SELECT "id", "cleaner_id", true FROM "dinner" WHERE "cleaner_id" IS NOT NULL ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "dish" SET "from_helper" = true WHERE "suggested_by" IS NULL;--> statement-breakpoint
UPDATE "expense" SET "created_by" = "paid_by" WHERE "created_by" IS NULL;
