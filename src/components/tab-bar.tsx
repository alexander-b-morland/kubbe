"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";

const tabs: { href: string; label: string; art: Art }[] = [
  { href: "/home", label: "Home", art: "home" },
  { href: "/shower", label: "Shower", art: "shower" },
  { href: "/laundry", label: "Laundry", art: "laundry" },
  { href: "/cleaning", label: "Cleaning", art: "cleaning" },
  { href: "/flat", label: "Flat", art: "flat" },
];

// Screens reached through the Flat tab keep it marked.
const underFlat = ["/flat", "/settings", "/dinner", "/shopping", "/expenses", "/happenings", "/board", "/people", "/profile"];

/** The bar at the bottom of every signed-in screen. */
export function TabBar() {
  const pathname = usePathname();
  // The tab you pressed is marked at once, before the server has answered with its screen.
  // The press is remembered together with the screen it was made on, so it stops counting
  // by itself once that screen has been replaced.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const current = pressed?.from === pathname ? pressed.href : pathname;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const inside = (base: string) => current === base || current.startsWith(`${base}/`);
          const active = tab.href === "/flat" ? underFlat.some(inside) : inside(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                onClick={() => setPressed({ href: tab.href, from: pathname })}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-inset ${active ? "text-ink" : "text-ink-soft"}`}
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
