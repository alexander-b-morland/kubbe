import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  // On Vercel the address is taken from the request when this is not set.
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No email sender yet, so addresses are not verified. Turn on with a domain.
    requireEmailVerification: false,
  },
  // Must be last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});
