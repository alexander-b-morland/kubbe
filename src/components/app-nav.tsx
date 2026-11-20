"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
import { m } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

type Tab = { href: string; label: string; art: Art; under: string[] };

const tabs: Tab[] = [
  { href: "/home", label: m("Home"), art: "home", under: [] },
  { href: "/calendar", label: m("Calendar"), art: "calendar", under: ["/calendar"] },
  { href: "/settings", label: m("Household"), art: "people", under: ["/settings", "/people"] },
  { href: "/profile", label: m("You"), art: "you", under: ["/profile"] },
];

export type NavArea = { key: string; name: string; href: string; art: Art; band: string };

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-inset";

// Whether the areas under Home are open, once the person has said so with the chevron.
// Kept for this visit, and in the browser for the next one when it lets us.
type Choice = "open" | "closed";
const CHOICE_KEY = "kubbe:nav-areas";
let chosen: Choice | null = null;
const listeners = new Set<() => void>();

function storedChoice(): Choice | null {
  if (chosen) return chosen;
  try {
    const value = window.localStorage.getItem(CHOICE_KEY);
    return value === "open" || value === "closed" ? value : null;
  } catch {
    return null;
  }
}

function choose(choice: Choice) {
  chosen = choice;
  try {
    window.localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // Storage blocked: the choice still holds until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The person's choice. The server knows none, so the first render matches it and the stored one follows. */
function useAreasChoice() {
  return useSyncExternalStore(subscribe, storedChoice, () => null);
}

/**
 * The way around the app: a bar at the bottom of a phone, a column down the left of a
 * wide screen. Home holds every area (shower, dinner, shopping and the rest). On a phone
 * a screen that belongs to none of the other tabs keeps Home marked; on a wide screen
 * the column lists the areas too, and marks the one you are in.
 */
export function AppNav({ areas }: { areas: NavArea[] }) {
  const t = useT();
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
  // The areas under Home: open on Home and inside an area, closed on the other tabs,
  // until the person opens or closes them themselves.
  const choice = useAreasChoice();
  const areasOpen = choice ? choice === "open" : !elsewhere;

  const tabLink = (tab: Tab) => {
    const here = elsewhere ? tab === elsewhere : tab.href === "/home" && !area;
    // On a phone, Home also stands for the area you opened from it.
    const within = tab.href === "/home" && Boolean(area);
    const isHome = tab.href === "/home";
    return (
      <li key={tab.href} className={`flex-1 lg:flex-none ${isHome ? "lg:flex lg:items-center lg:gap-1" : ""}`}>
        <Link
          href={tab.href}
          onClick={press(tab.href)}
          aria-current={here ? "page" : undefined}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold ${ring} lg:flex-1 lg:flex-row lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2 lg:text-base ${
            here ? "text-ink lg:bg-ink lg:text-paper" : within ? "text-ink lg:text-ink-soft" : "text-ink-soft"
          }`}
        >
          <RoomArt room={tab.art} className="size-7" />
          {t(tab.label)}
          {/* A pen stroke under the screen you are on. */}
          <svg viewBox="0 0 38 8" aria-hidden="true" className={`h-1.5 w-8 lg:hidden ${here || within ? "" : "invisible"}`}>
            <path d="M2 5C8 1 12 8 18 4C24 0 28 7 36 3" fill="none" stroke="var(--color-fjord)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </Link>
        {isHome ? (
          // On a wide screen, a chevron beside Home opens and closes the areas under it.
          <button
            type="button"
            onClick={() => choose(areasOpen ? "closed" : "open")}
            aria-expanded={areasOpen}
            aria-controls="nav-areas"
            aria-label={areasOpen ? t("Hide the areas") : t("Show the areas")}
            className={`hidden size-11 shrink-0 items-center justify-center rounded-2xl text-ink lg:flex ${ring}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-5 transition-transform duration-200 motion-reduce:transition-none ${areasOpen ? "rotate-180" : ""}`}>
              <path d="M5 9C7.500 11.300 9.800 13.600 12 16C14.200 13.600 16.500 11.300 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <nav
      aria-label={t("Main")}
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-56 lg:overflow-y-auto lg:border-t-0 lg:border-r-2 lg:pb-6"
    >
      {/* The mascot and the name, as the way home. Drawn still: the column stays put between screens. */}
      <Link
        href="/home"
        onClick={press("/home")}
        aria-label={t("Kubbe, home")}
        className={`mx-3 mt-6 mb-4 hidden items-center gap-2 rounded-2xl px-2 py-1 lg:flex ${ring}`}
      >
        {/* The logo fills its width, so the box around it sets the size. */}
        <span className="block w-16 shrink-0">
          <KubbeLogo label="" />
        </span>
        <span className="type-display text-4xl">{t("Kubbe")}</span>
      </Link>
      <ul className="mx-auto flex max-w-md lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {tabLink(tabs[0])}
        {/* On a wide screen, the areas sit under Home. */}
        <li className={areasOpen ? "hidden lg:block" : "hidden"}>
          <ul id="nav-areas" className="flex flex-col gap-0.5 pb-2 pl-3">
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
                    {t(item.name)}
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
