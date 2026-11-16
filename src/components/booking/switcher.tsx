import Link from "next/link";

type Item = { id: string; name: string; href: string; active: boolean };

/**
 * Pills for choosing between several of the same thing: two showers, or a washing
 * machine and a dryer. Sits in the coloured header of a booking screen.
 */
export function Switcher({ label, items, tone }: { label: string; items: Item[]; tone: "on-dark" | "on-light" }) {
  if (items.length < 2) return null;
  const look =
    tone === "on-dark"
      ? { edge: "border-paper focus-visible:ring-paper", active: "bg-paper text-fjord" }
      : { edge: "border-ink focus-visible:ring-ink", active: "bg-ink text-paper" };

  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 pt-1">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex h-11 items-center rounded-full border-2 px-4 font-bold outline-none focus-visible:ring-4 ${look.edge} ${item.active ? look.active : ""}`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
}

/** The links for a switcher: the first item is the default and needs no parameter. */
export function switcherItems<T extends { id: string; name: string }>(input: {
  basePath: string;
  param: string;
  all: T[];
  active: T;
  day?: string;
}): Item[] {
  const { basePath, param, all, active, day } = input;
  return all.map((item) => {
    const query = new URLSearchParams();
    if (item !== all[0]) query.set(param, item.id);
    if (day) query.set("day", day);
    const search = query.toString();
    return { id: item.id, name: item.name, href: search ? `${basePath}?${search}` : basePath, active: item === active };
  });
}
