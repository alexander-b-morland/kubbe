"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoomArt, type Art } from "@/components/illustrations/room-art";

const tabs: { href: string; label: string; art: Art }[] = [
  { href: "/home", label: "Home", art: "home" },
  { href: "/shower", label: "Shower", art: "shower" },
  { href: "/laundry", label: "Laundry", art: "laundry" },
  { href: "/cleaning", label: "Cleaning", art: "cleaning" },
  { href: "/settings", label: "Household", art: "people" },
];

/** The bar at the bottom of every signed-in screen. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold outline-none focus-visible:bg-fjord/15 ${active ? "text-ink" : "text-ink-soft"}`}
              >
                <RoomArt room={tab.art} className="size-7" />
                {tab.label}
                {/* A pen stroke under the screen you are on. */}
                <svg viewBox="0 0 38 8" aria-hidden="true" className={`h-1.5 w-8 ${active ? "" : "invisible"}`}>
                  <path
                    d="M2 5C8 1 12 8 18 4C24 0 28 7 36 3"
                    fill="none"
                    stroke="var(--color-fjord)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
