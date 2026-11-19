// Money maths, as pure functions. Amounts are whole minor units (øre, cents): never
// fractions, so nothing is lost to rounding and every split adds up exactly.

/** "349", "349,50" or "349.5" as minor units. Null when it is not an amount. */
export function parseAmount(input: string): number | null {
  const text = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 ? amount : null;
}

/**
 * Why a text is not an amount, for saying what to fix. Null when it is one.
 * "zero" also covers an empty box.
 */
export function amountProblem(input: string): "empty" | "zero" | "negative" | "decimals" | "too-big" | "not-a-number" | null {
  const text = input.trim().replace(/\s/g, "").replace(",", ".");
  if (text === "") return "empty";
  if (/^-/.test(text)) return "negative";
  if (!/^\d+(\.\d*)?$/.test(text)) return "not-a-number";
  if (/\.\d{3,}$/.test(text)) return "decimals";
  if (text.split(".")[0].length > 7) return "too-big";
  return Number(text) > 0 ? null : "zero";
}

/** The sentence for each problem, ending in what to do. */
export const AMOUNT_MESSAGES: Record<NonNullable<ReturnType<typeof amountProblem>>, string> = {
  empty: "Enter an amount, like 349 or 349,50.",
  zero: "The amount must be more than 0.",
  negative: "The amount can't be negative. Enter what was paid.",
  decimals: "Use at most two decimals, like 349,50.",
  "too-big": "That is more than Kubbe keeps track of. Enter an amount under 10 million.",
  "not-a-number": "Enter an amount in numbers, like 349 or 349,50.",
};

/** "349 kr", "349,50 kr" or "24 000 kr": a comma for decimals, as the amount is typed, and a space between thousands. */
export function formatAmount(amount: number, currency: string): string {
  const absolute = Math.abs(amount);
  const whole = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const rest = absolute % 100;
  return `${whole}${rest ? `,${String(rest).padStart(2, "0")}` : ""} ${currency}`.trim();
}

/** Split an amount between people as evenly as whole units allow. The first ones get the odd units. */
export function splitEvenly(amount: number, userIds: readonly string[]): { userId: string; amount: number }[] {
  if (userIds.length === 0) return [];
  const base = Math.floor(amount / userIds.length);
  const extra = amount - base * userIds.length;
  return userIds.map((userId, index) => ({ userId, amount: base + (index < extra ? 1 : 0) }));
}

/** How a cost is shared: evenly between some people, or as an amount each. */
export type Split = { kind: "even"; userIds: readonly string[] } | { kind: "amounts"; parts: readonly { userId: string; amount: number }[] };

/**
 * Each person's part of a cost. "empty" when nobody shares it, "mismatch" when the
 * amounts typed in do not add up to the whole.
 */
export function sharesFor(amount: number, split: Split): { userId: string; amount: number }[] | "empty" | "mismatch" {
  if (split.kind === "even") return split.userIds.length === 0 ? "empty" : splitEvenly(amount, split.userIds);
  const parts = split.parts.filter((part) => part.amount > 0);
  if (parts.length === 0) return "empty";
  return parts.reduce((sum, part) => sum + part.amount, 0) === amount ? parts.map(({ userId, amount: part }) => ({ userId, amount: part })) : "mismatch";
}

/** What one person owes and is owed, out of the payments that make everyone square. */
export function mySettlements(transfers: readonly Transfer[], me: string): { owe: Transfer[]; owed: Transfer[] } {
  return { owe: transfers.filter((transfer) => transfer.from === me), owed: transfers.filter((transfer) => transfer.to === me) };
}

type Entry = { paidBy: string; amount: number; shares: readonly { userId: string; amount: number }[] };

/**
 * Where everyone stands: positive means the flat owes you, negative means you owe.
 * Paying counts for you, your share of each expense counts against you.
 */
export function balances(entries: readonly Entry[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (userId: string, amount: number) => net.set(userId, (net.get(userId) ?? 0) + amount);
  for (const entry of entries) {
    add(entry.paidBy, entry.amount);
    for (const share of entry.shares) add(share.userId, -share.amount);
  }
  return net;
}

export type Transfer = { from: string; to: string; amount: number };

/**
 * The payments that would make everyone square: whoever owes most pays whoever is
 * owed most, and so on. This gives few payments, which is what people want.
 */
export function settleUp(net: ReadonlyMap<string, number>): Transfer[] {
  const owes = [...net].filter(([, amount]) => amount < 0).map(([userId, amount]) => ({ userId, amount: -amount }));
  const owed = [...net].filter(([, amount]) => amount > 0).map(([userId, amount]) => ({ userId, amount }));
  // Largest first; ties by id, so the same balances always give the same payments.
  const order = (a: { userId: string; amount: number }, b: { userId: string; amount: number }) =>
    b.amount - a.amount || a.userId.localeCompare(b.userId);
  owes.sort(order);
  owed.sort(order);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < owes.length && j < owed.length) {
    const amount = Math.min(owes[i].amount, owed[j].amount);
    if (amount > 0) transfers.push({ from: owes[i].userId, to: owed[j].userId, amount });
    owes[i].amount -= amount;
    owed[j].amount -= amount;
    if (owes[i].amount === 0) i++;
    if (owed[j].amount === 0) j++;
  }
  return transfers;
}
