CREATE TABLE "dinner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"day" text NOT NULL,
	"time" integer NOT NULL,
	"cook_id" text,
	"cleaner_id" text,
	"chosen_dish_id" uuid,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_absence" (
	"dinner_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "dinner_absence_dinner_id_user_id_pk" PRIMARY KEY("dinner_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dinner_rule" (
	"household_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"time" integer NOT NULL,
	CONSTRAINT "dinner_rule_household_id_weekday_pk" PRIMARY KEY("household_id","weekday")
);
--> statement-breakpoint
CREATE TABLE "dish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dinner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"suggested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"name" text NOT NULL,
	"at_home" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_vote" (
	"dish_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "dish_vote_dish_id_user_id_pk" PRIMARY KEY("dish_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"paid_by" text NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"is_settlement" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_share" (
	"expense_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "expense_share_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "happening" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "happening_reply" (
	"happening_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"going" boolean NOT NULL,
	CONSTRAINT "happening_reply_happening_id_user_id_pk" PRIMARY KEY("happening_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"is_task" boolean DEFAULT false NOT NULL,
	"assignee_id" text,
	"done_at" timestamp with time zone,
	"done_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"avatar" text DEFAULT 'trout' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avoids" text DEFAULT '' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"added_by" text,
	"claimed_by" text,
	"bought_at" timestamp with time zone,
	"bought_by" text,
	"expense_id" uuid,
	"ingredient_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "extras" text[] DEFAULT '{dinner,happenings,shopping,expenses,board}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "currency" text DEFAULT 'kr' NOT NULL;--> statement-breakpoint
ALTER TABLE "dinner" ADD CONSTRAINT "dinner_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner" ADD CONSTRAINT "dinner_cook_id_user_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner" ADD CONSTRAINT "dinner_cleaner_id_user_id_fk" FOREIGN KEY ("cleaner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_absence" ADD CONSTRAINT "dinner_absence_dinner_id_dinner_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_absence" ADD CONSTRAINT "dinner_absence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_rule" ADD CONSTRAINT "dinner_rule_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_dinner_id_dinner_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_suggested_by_user_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredient" ADD CONSTRAINT "dish_ingredient_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_vote" ADD CONSTRAINT "dish_vote_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_vote" ADD CONSTRAINT "dish_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_share" ADD CONSTRAINT "expense_share_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_share" ADD CONSTRAINT "expense_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "happening" ADD CONSTRAINT "happening_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "happening" ADD CONSTRAINT "happening_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "happening_reply" ADD CONSTRAINT "happening_reply_happening_id_happening_id_fk" FOREIGN KEY ("happening_id") REFERENCES "public"."happening"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "happening_reply" ADD CONSTRAINT "happening_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_done_by_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_bought_by_user_id_fk" FOREIGN KEY ("bought_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_ingredient_id_dish_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."dish_ingredient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dinner_one_per_day" ON "dinner" USING btree ("household_id","day");--> statement-breakpoint
CREATE INDEX "dish_dinner_idx" ON "dish" USING btree ("dinner_id");--> statement-breakpoint
CREATE INDEX "dish_ingredient_dish_idx" ON "dish_ingredient" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "expense_household_idx" ON "expense" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "happening_household_idx" ON "happening" USING btree ("household_id","starts_at");--> statement-breakpoint
CREATE INDEX "note_household_idx" ON "note" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "shopping_item_household_idx" ON "shopping_item" USING btree ("household_id","created_at");--> statement-breakpoint
-- Hand-written from here on.
ALTER TABLE "expense" ADD CONSTRAINT "expense_amount_positive" CHECK ("amount" > 0);
--> statement-breakpoint
ALTER TABLE "expense_share" ADD CONSTRAINT "expense_share_not_negative" CHECK ("amount" >= 0);
--> statement-breakpoint
ALTER TABLE "dinner_rule" ADD CONSTRAINT "dinner_rule_weekday" CHECK ("weekday" BETWEEN 1 AND 7);
--> statement-breakpoint
ALTER TABLE "dinner" ADD CONSTRAINT "dinner_chosen_dish_fk" FOREIGN KEY ("chosen_dish_id") REFERENCES "dish"("id") ON DELETE SET NULL;
