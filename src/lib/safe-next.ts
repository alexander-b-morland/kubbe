/**
 * Where to go after signing in or up. Only an invite link is accepted, and only in
 * exactly that shape: checking for "starts with a slash" is not enough, because
 * browsers treat paths such as "/\evil.com" as another site.
 */
export function safeNextPath(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/join\/[A-Za-z0-9]{1,12}$/.test(next) ? next : fallback;
}
