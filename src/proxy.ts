import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { dinner, user } from "@/db/schema";

// A link to a roommate or a dinner that does not exist gets a real 404.
//
// The pages show "not found" themselves, but by the time they know, the response has
// already started as 200 (every screen streams, see the Next.js streaming guide). So the
// address is checked here, before the page renders. Only whether the thing exists at all
// is checked: whether it belongs to the reader's household is still decided by the page,
// which shows the same "not found" for both.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function exists(kind: string, id: string): Promise<boolean> {
  if (kind === "dinner") {
    if (!UUID.test(id)) return false;
    const [found] = await db.select({ id: dinner.id }).from(dinner).where(eq(dinner.id, id)).limit(1);
    return Boolean(found);
  }
  if (id.length === 0 || id.length > 100) return false;
  const [found] = await db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1);
  return Boolean(found);
}

export async function proxy(request: NextRequest) {
  // Server actions on these screens arrive as POSTs: they check for themselves.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  const [, kind, id = ""] = request.nextUrl.pathname.split("/");
  try {
    if (await exists(kind, decodeURIComponent(id))) return NextResponse.next();
  } catch {
    // If the database cannot be asked, let the page answer as before.
    return NextResponse.next();
  }
  // An address no route has: Next.js renders the not-found screen with a 404.
  return NextResponse.rewrite(new URL("/_gone", request.url));
}

export const config = {
  matcher: ["/people/:id", "/dinner/:id"],
};
