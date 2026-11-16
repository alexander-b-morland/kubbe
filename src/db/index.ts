import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

// A pooled WebSocket connection, so that bookings can run inside real transactions.
const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export type Database = typeof db;

/** The handle a `db.transaction` callback receives. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
