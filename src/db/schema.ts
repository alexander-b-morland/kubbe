import {
  boolean,
  index,
  integer,
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

export type Household = typeof household.$inferSelect;
export type Membership = typeof membership.$inferSelect;
export type Resource = typeof resource.$inferSelect;
export type Booking = typeof booking.$inferSelect;
export type CleaningArea = typeof cleaningArea.$inferSelect;
