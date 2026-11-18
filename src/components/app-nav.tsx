"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";

const tabs: { href: string; label: string; art: Art; under: string[] }[] = [
  { href: "/home", label: "Home", art: "home", under: [] },
  { href: "/calendar", label: "Calendar", art: "calendar", under: ["/calendar"] },
  { href: "/settings", label: "Household", art: "people", under: ["/settings", "/people"] },
  { href: "/profile", label: "You", art: "you", under: ["/profile"] },
];

/**
 * The way around the app: a bar at the bottom of a phone, a column down the left of a
 * wide screen. Home holds every area (shower, dinner, shopping and the rest), so a
 * screen that belongs to none of the other tabs keeps Home marked.
 */
export function AppNav() {
  const pathname = usePathname();
  // The tab you pressed is marked at once, before the server has answered with its screen.
  // The press is remembered together with the screen it was made on, so it stops counting
  // by itself once that screen has been replaced.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const current = pressed?.from === pathname ? pressed.href : pathname;
  const inside = (base: string) => current === base || current.startsWith(`${base}/`);
  const elsewhere = tabs.find((tab) => tab.under.some(inside));
  const active = (tab: (typeof tabs)[number]) => (elsewhere ? tab === elsewhere : tab.href === "/home");

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-56 lg:border-t-0 lg:border-r-2 lg:pb-0"
    >
      <p className="type-display hidden px-6 pt-8 pb-6 text-4xl lg:block">Kubbe</p>
      <ul className="mx-auto flex max-w-md lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {tabs.map((tab) => {
          const on = active(tab);
          return (
            <li key={tab.href} className="flex-1 lg:flex-none">
              <Link
                href={tab.href}
                onClick={() => setPressed({ href: tab.href, from: pathname })}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-inset lg:flex-row lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2 lg:text-base ${on ? "text-ink lg:bg-ink lg:text-paper" : "text-ink-soft"}`}
              >
                <RoomArt room={tab.art} className="size-7" />
                {tab.label}
                {/* A pen stroke under the screen you are on. */}
                <svg viewBox="0 0 38 8" aria-hidden="true" className={`h-1.5 w-8 lg:hidden ${on ? "" : "invisible"}`}>
                  <path d="M2 5C8 1 12 8 18 4C24 0 28 7 36 3" fill="none" stroke="var(--color-fjord)" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
