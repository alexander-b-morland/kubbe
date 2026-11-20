CREATE TABLE "note_reaction" (
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_reaction_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "removal_notice" (
	"user_id" text PRIMARY KEY NOT NULL,
	"household_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household" ALTER COLUMN "extras" SET DEFAULT '{shower,laundry,cleaning,dinner,happenings,shopping,expenses,board}'::text[];--> statement-breakpoint
ALTER TABLE "note_reaction" ADD CONSTRAINT "note_reaction_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_reaction" ADD CONSTRAINT "note_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "removal_notice" ADD CONSTRAINT "removal_notice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Shower, laundry and cleaning could not be switched off before; every household has them on.
UPDATE "household" SET "extras" = ARRAY['shower','laundry','cleaning']::text[] || "extras" WHERE NOT ("extras" @> ARRAY['shower','laundry','cleaning']::text[]);
