"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";

type Tab = { href: string; label: string; art: Art; under: string[] };

const tabs: Tab[] = [
  { href: "/home", label: "Home", art: "home", under: [] },
  { href: "/calendar", label: "Calendar", art: "calendar", under: ["/calendar"] },
  { href: "/settings", label: "Household", art: "people", under: ["/settings", "/people"] },
  { href: "/profile", label: "You", art: "you", under: ["/profile"] },
];

export type NavArea = { key: string; name: string; href: string; art: Art; band: string };

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-inset";

/**
 * The way around the app: a bar at the bottom of a phone, a column down the left of a
 * wide screen. Home holds every area (shower, dinner, shopping and the rest). On a phone
 * a screen that belongs to none of the other tabs keeps Home marked; on a wide screen
 * the column lists the areas too, and marks the one you are in.
 */
export function AppNav({ areas }: { areas: NavArea[] }) {
  const pathname = usePathname();
  // The tab you pressed is marked at once, before the server has answered with its screen.
  // The press is remembered together with the screen it was made on, so it stops counting
  // by itself once that screen has been replaced.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const current = pressed?.from === pathname ? pressed.href : pathname;
  const inside = (base: string) => current === base || current.startsWith(`${base}/`);
  const elsewhere = tabs.find((tab) => tab.under.some(inside));
  const area = areas.find((candidate) => inside(candidate.href));
  const press = (href: string) => () => setPressed({ href, from: pathname });

  const tabLink = (tab: Tab) => {
    const here = elsewhere ? tab === elsewhere : tab.href === "/home" && !area;
    // On a phone, Home also stands for the area you opened from it.
    const within = tab.href === "/home" && Boolean(area);
    return (
      <li key={tab.href} className="flex-1 lg:flex-none">
        <Link
          href={tab.href}
          onClick={press(tab.href)}
          aria-current={here ? "page" : undefined}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold ${ring} lg:flex-row lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2 lg:text-base ${
            here ? "text-ink lg:bg-ink lg:text-paper" : within ? "text-ink lg:text-ink-soft" : "text-ink-soft"
          }`}
        >
          <RoomArt room={tab.art} className="size-7" />
          {tab.label}
          {/* A pen stroke under the screen you are on. */}
          <svg viewBox="0 0 38 8" aria-hidden="true" className={`h-1.5 w-8 lg:hidden ${here || within ? "" : "invisible"}`}>
            <path d="M2 5C8 1 12 8 18 4C24 0 28 7 36 3" fill="none" stroke="var(--color-fjord)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-56 lg:overflow-y-auto lg:border-t-0 lg:border-r-2 lg:pb-6"
    >
      <p className="type-display hidden px-6 pt-8 pb-6 text-4xl lg:block">Kubbe</p>
      <ul className="mx-auto flex max-w-md lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {tabLink(tabs[0])}
        {/* On a wide screen, every area sits under Home. */}
        <li className="hidden lg:block">
          <ul className="flex flex-col gap-0.5 pb-2 pl-3">
            {areas.map((item) => {
              const here = item === area;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={press(item.href)}
                    aria-current={here ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-2 py-1.5 font-semibold ${ring} ${here ? "bg-ink text-paper" : "text-ink"}`}
                  >
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${item.band}`}>
                      <RoomArt room={item.art} className="size-5" />
                    </span>
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
        {tabs.slice(1).map(tabLink)}
      </ul>
    </nav>
  );
}
