import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Auth tables. Their shape is dictated by Better Auth; do not rename the keys.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("account_user_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Households. Everything a user does happens inside exactly one household.
// ---------------------------------------------------------------------------

export const household = pgTable("household", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Short code roommates type in to join. An admin can replace it. */
  joinCode: text("join_code").notNull().unique(),
  /** IANA zone name. All slot maths happens in this zone. */
  timeZone: text("time_zone").notNull().default("Europe/Oslo"),
  /** The extras this household has switched on. See src/lib/extras.ts. */
  extras: text("extras")
    .array()
    .notNull()
    .default(sql`'{dinner,happenings,shopping,expenses,board}'::text[]`),
  /** What an amount of money is followed by: "kr". */
  currency: text("currency").notNull().default("kr"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
});

export const memberRole = pgEnum("member_role", ["admin", "member"]);

export const membership = pgTable(
  "membership",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    /** The colour this person shows up with in the household. */
    colour: text("colour").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.userId] }),
    // One household per person for now. Drop this index to allow several.
    uniqueIndex("membership_one_household_per_user").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Booking. A resource is one bookable thing (a shower, a washing machine).
// Slots are never stored: they are worked out from the resource's settings.
// ---------------------------------------------------------------------------

export const resourceKind = pgEnum("resource_kind", ["shower", "washer", "dryer"]);

export const resource = pgTable(
  "resource",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    kind: resourceKind("kind").notNull(),
    name: text("name").notNull(),
    /** A household can switch a resource off, for example when it has no dryer. */
    enabled: boolean("enabled").notNull().default(true),
    slotMinutes: integer("slot_minutes").notNull(),
    /** Bookable hours as minutes after midnight, in the household's time zone. */
    opensAt: integer("opens_at").notNull(),
    closesAt: integer("closes_at").notNull(),
    maxPerDay: integer("max_per_day").notNull(),
    allowBackToBack: boolean("allow_back_to_back").notNull().default(false),
    /** How many days ahead a slot can be booked. 0 means today only. */
    bookAheadDays: integer("book_ahead_days").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("resource_household_idx").on(table.householdId)],
);

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  // The migration also adds an exclusion constraint, booking_no_overlap, which
  // makes the database refuse two bookings of one resource that overlap in time.
  (table) => [
    index("booking_resource_time_idx").on(table.resourceId, table.startsAt),
    index("booking_user_idx").on(table.userId, table.endsAt),
    index("booking_household_idx").on(table.householdId),
  ],
);

// ---------------------------------------------------------------------------
// Cleaning. A room has a rhythm; whose turn it is follows from that and from the
// order people joined (see src/lib/cleaning/rota.ts). Only exceptions are stored.
// ---------------------------------------------------------------------------

export const cleaningArea = pgTable(
  "cleaning_area",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    intervalDays: integer("interval_days").notNull(),
    /** A rough guide for whoever's turn it is. */
    estimateMinutes: integer("estimate_minutes").notNull(),
    /** First day of the first period, YYYY-MM-DD in the household's zone. */
    startDay: text("start_day").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("cleaning_area_household_idx").on(table.householdId)],
);

/** A period of a room that somebody cleaned. */
export const cleaningDone = pgTable(
  "cleaning_done",
  {
    areaId: uuid("area_id")
      .notNull()
      .references(() => cleaningArea.id, { onDelete: "cascade" }),
    period: integer("period").notNull(),
    doneBy: text("done_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.areaId, table.period] })],
);

/**
 * A period of a room that belongs to a named person instead of whoever the rotation
 * gives. Either somebody took the turn over, or the turn was pinned: when people move
 * in or out, or a room is removed, the rotation shifts, and the turns already under
 * way are pinned first so nobody's current turn changes under them.
 */
export const cleaningTakeover = pgTable(
  "cleaning_takeover",
  {
    areaId: uuid("area_id")
      .notNull()
      .references(() => cleaningArea.id, { onDelete: "cascade" }),
    period: integer("period").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.areaId, table.period] })],
);

// ---------------------------------------------------------------------------
// Rate limiting. One row per thing being counted, for example sign-ins for one
// email address. See src/lib/rate-limit.ts.
// ---------------------------------------------------------------------------

export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Profiles. One per person, wherever they live.
// ---------------------------------------------------------------------------

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** One of the drawn avatars in src/components/avatar. */
  avatar: text("avatar").notNull().default("trout"),
  bio: text("bio").notNull().default(""),
  /** What this person does not eat. Used when suggesting dinners. */
  avoids: text("avoids").notNull().default(""),
  /** Answers to the fun questions, by question key. */
  answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
});

// ---------------------------------------------------------------------------
// Noticeboard. A note is free text. A note can also be a to-do, for one person
// or for anyone, which gets ticked off.
// ---------------------------------------------------------------------------

export const note = pgTable(
  "note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isTask: boolean("is_task").notNull().default(false),
    /** Who the to-do is for. Null means anyone. */
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: text("done_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("note_household_idx").on(table.householdId, table.createdAt)],
);

// ---------------------------------------------------------------------------
// Money. An expense is paid by one person and shared between some. A settlement
// (one person paying another back) is an expense whose only share is the receiver's.
// Amounts are whole minor units (øre, cents), never fractions.
// ---------------------------------------------------------------------------

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    isSettlement: boolean("is_settlement").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("expense_household_idx").on(table.householdId, table.createdAt)],
);

export const expenseShare = pgTable(
  "expense_share",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
  },
  (table) => [primaryKey({ columns: [table.expenseId, table.userId] })],
);

// ---------------------------------------------------------------------------
// Happenings. Something social, with who is in.
// ---------------------------------------------------------------------------

export const happening = pgTable(
  "happening",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    place: text("place").notNull().default(""),
    details: text("details").notNull().default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [index("happening_household_idx").on(table.householdId, table.startsAt)],
);

export const happeningReply = pgTable(
  "happening_reply",
  {
    happeningId: uuid("happening_id")
      .notNull()
      .references(() => happening.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    going: boolean("going").notNull(),
  },
  (table) => [primaryKey({ columns: [table.happeningId, table.userId] })],
);

// ---------------------------------------------------------------------------
// Dinners. A dinner is on one day. Roommates say whether they are in, suggest
// dishes, vote, and volunteer to cook and to clean up. Fixed weekdays are rules
// that new dinners are made from.
// ---------------------------------------------------------------------------

export const dinnerRule = pgTable(
  "dinner_rule",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    /** 1 is Monday, 7 is Sunday. */
    weekday: integer("weekday").notNull(),
    /** Minutes after midnight in the household's zone. */
    time: integer("time").notNull(),
  },
  (table) => [primaryKey({ columns: [table.householdId, table.weekday] })],
);

export const dinner = pgTable(
  "dinner",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD in the household's zone. One dinner a day. */
    day: text("day").notNull(),
    time: integer("time").notNull(),
    cookId: text("cook_id").references(() => user.id, { onDelete: "set null" }),
    cleanerId: text("cleaner_id").references(() => user.id, { onDelete: "set null" }),
    /** The dish that will be cooked, once it is settled. */
    chosenDishId: uuid("chosen_dish_id"),
    /** A dinner made from a weekday rule that someone then called off. */
    cancelled: boolean("cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("dinner_one_per_day").on(table.householdId, table.day)],
);

/** Someone who said they are not coming. Everyone else in the household is in. */
export const dinnerAbsence = pgTable(
  "dinner_absence",
  {
    dinnerId: uuid("dinner_id")
      .notNull()
      .references(() => dinner.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.dinnerId, table.userId] })],
);

export const dish = pgTable(
  "dish",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dinnerId: uuid("dinner_id")
      .notNull()
      .references(() => dinner.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Null when the idea came from the suggestion helper, not a person. */
    suggestedBy: text("suggested_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("dish_dinner_idx").on(table.dinnerId)],
);

export const dishVote = pgTable(
  "dish_vote",
  {
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dish.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.dishId, table.userId] })],
);

export const dishIngredient = pgTable(
  "dish_ingredient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dish.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "We already have that": nobody needs to buy it. */
    atHome: boolean("at_home").notNull().default(false),
  },
  (table) => [index("dish_ingredient_dish_idx").on(table.dishId)],
);

// ---------------------------------------------------------------------------
// Shopping. One list per household. An item can come from a dinner's chosen dish.
// Someone can say "I'll buy it"; whoever buys it ticks it off; and what was paid
// for a batch of ticked items becomes an expense.
// ---------------------------------------------------------------------------

export const shoppingItem = pgTable(
  "shopping_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    /** Who said they will buy it. */
    claimedBy: text("claimed_by").references(() => user.id, { onDelete: "set null" }),
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    boughtBy: text("bought_by").references(() => user.id, { onDelete: "set null" }),
    /** Set once what was paid for it has been logged. */
    expenseId: uuid("expense_id").references(() => expense.id, { onDelete: "set null" }),
    /** Set when the item is an ingredient of a dinner's dish. */
    ingredientId: uuid("ingredient_id").references(() => dishIngredient.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [index("shopping_item_household_idx").on(table.householdId, table.createdAt)],
);

export type Household = typeof household.$inferSelect;
export type Membership = typeof membership.$inferSelect;
export type Resource = typeof resource.$inferSelect;
export type Booking = typeof booking.$inferSelect;
export type CleaningArea = typeof cleaningArea.$inferSelect;
