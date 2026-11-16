import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

// Counts attempts in the database, so the count is shared by every server instance
// and survives restarts. Used where guessing pays off: passwords and join codes.

/**
 * Count one attempt against `key`. Returns false once more than `max` attempts have
 * been made within the window. Limits apply in production only, so local work and
 * the browser tests are not slowed down.
 */
export async function allowAttempt(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;

  const window = sql`now() + make_interval(secs => ${windowSeconds})`;
  const expired = sql`${rateLimit.resetsAt} <= now()`;
  const [row] = await db
    .insert(rateLimit)
    .values({ key, count: 1, resetsAt: window })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        resetsAt: sql`case when ${expired} then ${window} else ${rateLimit.resetsAt} end`,
      },
    })
    .returning({ count: rateLimit.count });

  // Now and then, clear out rows nobody needs any more.
  if (Math.random() < 0.02) {
    await db.delete(rateLimit).where(lt(rateLimit.resetsAt, sql`now() - interval '1 day'`));
  }
  return row.count <= max;
}

/** The address a request came from. Vercel sets this header itself, so it can be trusted there. */
export async function clientAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export const tooManyAttempts = "Too many attempts. Wait a few minutes and try again.";
