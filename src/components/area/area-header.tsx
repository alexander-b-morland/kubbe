import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";
import { areaOf, type AreaKey } from "@/lib/areas";
import { getT } from "@/lib/i18n/server";

export type Back = { href: string; label: string };

const HOME: Back = { href: "/home", label: "Home" };

/** The way back, top left on every screen below Home. Drawn in the colour of whatever it sits on. */
export async function BackLink({ href, label, ring = "focus-visible:ring-fjord" }: Back & { ring?: string }) {
  // The label is the name of a screen ("Home", "All dinners"), written once in English where the link is made.
  const t = await getT();
  return (
    <Link
      href={href}
      data-testid="back"
      className={`flex min-h-11 w-fit items-center gap-1.5 rounded-full border-2 border-current py-1 pr-4 pl-3 text-sm font-bold outline-none focus-visible:ring-4 ${ring}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0">
        <path d="M20 12C15 11.500 9 11.500 4 12M10 6C8 8 6 10 4 12C6 14 8 16 10 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t(label)}
    </Link>
  );
}

/** The area's colour as CSS variables, for the element that holds its screen. */
export function areaStyle(area: AreaKey, more?: CSSProperties): CSSProperties {
  return { ...areaOf(area).vars, ...more } as CSSProperties;
}

type BandProps = {
  band: string;
  ring: string;
  art: Art;
  /** Read out before the headline, so the heading makes sense on its own: "Shower". */
  name: string;
  eyebrow: string;
  children: ReactNode;
  back?: Back;
  extra?: ReactNode;
};

/**
 * A band across the top of a screen: the way back, a small line, the headline that says
 * what matters right now, and a drawing. The small line and the headline are one
 * heading, so someone who hears only the heading still knows which screen this is.
 */
async function Band({ band, ring, art, name: plainName, eyebrow, children, back, extra }: BandProps) {
  const name = (await getT())(plainName);
  return (
    <header className={`flex flex-col gap-3 p-6 pt-5 lg:rounded-3xl ${band}`}>
      {back ? <BackLink {...back} ring={ring} /> : null}
      <div className="flex items-start justify-between gap-3">
        <h1 className="flex min-w-0 flex-col gap-1 pt-1">
          {eyebrow.toLowerCase().startsWith(name.toLowerCase()) ? null : <span className="sr-only">{name}. </span>}
          <span className="font-sans text-base font-semibold">{eyebrow}</span>
          <span className="sr-only">: </span>
          <span className="type-display line-clamp-3 text-5xl break-words min-[380px]:text-6xl" data-testid="headline">
            {children}
          </span>
        </h1>
        <RoomArt room={art} animate className="size-20 shrink-0 min-[380px]:size-24" />
      </div>
      {extra}
    </header>
  );
}

/** The top of an area's screen, in the area's colour. */
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
    <Band band={look.band} ring={look.ring} art={look.art} name={look.name} eyebrow={eyebrow} back={back} extra={extra}>
      {children}
    </Band>
  );
}

/** The top of a screen that belongs to no area (Calendar, Household, You): the same band, in ink. */
export function TabHeader({ art, name, eyebrow, children, back, extra }: { art: Art; name: string; eyebrow: string; children: ReactNode; back?: Back; extra?: ReactNode }) {
  return (
    <Band band="bg-ink text-paper" ring="focus-visible:ring-ochre" art={art} name={name} eyebrow={eyebrow} back={back} extra={extra}>
      {children}
    </Band>
  );
}

/**
 * A whole screen for an area: the header band, then the content with room around it.
 * With `aside`, a wide screen puts that beside the content instead of below it.
 */
export function AreaPage({
  area,
  eyebrow,
  title,
  back,
  headerExtra,
  aside,
  children,
}: {
  area: AreaKey;
  eyebrow: string;
  title: ReactNode;
  back?: Back;
  headerExtra?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={`mx-auto flex w-full max-w-md flex-col lg:pt-6 ${aside ? "lg:max-w-6xl" : "lg:max-w-3xl"}`} style={areaStyle(area)}>
      <AreaHeader area={area} eyebrow={eyebrow} back={back} extra={headerExtra}>
        {title}
      </AreaHeader>
      {aside ? (
        <div className="flex flex-col gap-8 p-6 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-10">
          <div className="flex min-w-0 flex-col gap-8">{children}</div>
          <div className="flex min-w-0 flex-col gap-8">{aside}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-8 p-6">{children}</div>
      )}
    </main>
  );
}
