import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

// A pooled WebSocket connection, so that bookings can run inside real transactions.
const pool = new Pool({ connectionString: env.DATABASE_URL });

// A connection that sits idle can drop: the database goes to sleep, or the network blips.
// Without a listener Node treats that as an uncaught exception. The pool opens a new
// connection the next time one is needed, so noting it is enough.
pool.on("error", () => {
  console.error("A database connection dropped while idle. The next query opens a new one.");
});

export const db = drizzle({ client: pool, schema });
export type Database = typeof db;

/** The handle a `db.transaction` callback receives. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
