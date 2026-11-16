import type { ReactNode } from "react";
import { RoomArt, type Art } from "@/components/illustrations/room-art";

/** The top of an extras screen: a small line, a big headline, and the area's drawing. */
export function ExtraHeader({ art, eyebrow, children }: { art: Art; eyebrow: string; children: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-ink-soft">{eyebrow}</p>
        <h1 className="type-display text-6xl break-words" data-testid="headline">
          {children}
        </h1>
      </div>
      <RoomArt room={art} animate className="size-20 shrink-0" />
    </header>
  );
}
