ALTER TABLE "dinner" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "dish_ingredient" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "dinner" ADD CONSTRAINT "dinner_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredient" ADD CONSTRAINT "dish_ingredient_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;