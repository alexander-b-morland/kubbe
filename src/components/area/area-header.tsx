import Link from "next/link";
import type { ReactNode } from "react";
import { RoomArt } from "@/components/illustrations/room-art";
import { areaOf, type AreaKey } from "@/lib/areas";

export type Back = { href: string; label: string };

const HOME: Back = { href: "/home", label: "Home" };

/** The way back, top left on every screen below Home. Drawn in the colour of whatever it sits on. */
export function BackLink({ href, label, ring = "focus-visible:ring-fjord" }: Back & { ring?: string }) {
  return (
    <Link
      href={href}
      data-testid="back"
      className={`flex min-h-11 w-fit items-center gap-1.5 rounded-full border-2 border-current py-1 pr-4 pl-3 text-sm font-bold outline-none focus-visible:ring-4 ${ring}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0">
        <path d="M20 12C15 11.500 9 11.500 4 12M10 6C8 8 6 10 4 12C6 14 8 16 10 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}

/**
 * The top of an area's screen: a band in the area's colour with the way back, a small
 * line, the headline that says what matters right now, and the area's drawing.
 */
export function AreaHeader({
  area,
  eyebrow,
  children,
  back = HOME,
  extra,
}: {
  area: AreaKey;
  eyebrow: string;
  children: ReactNode;
  back?: Back;
  /** Shown under the headline, for example a switcher between machines. */
  extra?: ReactNode;
}) {
  const look = areaOf(area);
  return (
    <header className={`flex flex-col gap-3 p-6 pt-5 lg:rounded-3xl ${look.band}`}>
      <BackLink {...back} ring={look.ring} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 pt-1">
          <p className="font-semibold">{eyebrow}</p>
          <h1 className="type-display text-6xl break-words" data-testid="headline">
            {children}
          </h1>
        </div>
        <RoomArt room={look.art} animate className="size-24 shrink-0" />
      </div>
      {extra}
    </header>
  );
}

/** A whole screen for an area: the header band, then the content with room around it. */
export function AreaPage({
  area,
  eyebrow,
  title,
  back,
  headerExtra,
  children,
}: {
  area: AreaKey;
  eyebrow: string;
  title: ReactNode;
  back?: Back;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      <AreaHeader area={area} eyebrow={eyebrow} back={back} extra={headerExtra}>
        {title}
      </AreaHeader>
      <div className="flex flex-col gap-8 p-6">{children}</div>
    </main>
  );
}
