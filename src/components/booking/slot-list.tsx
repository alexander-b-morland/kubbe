"use client";

import { useOptimistic, useState, useTransition } from "react";
import "./booking.css";

export type SlotRow = {
  /** When the slot starts, as an ISO string. Also its identity. */
  key: string;
  time: string;
  state: "free" | "mine" | "taken" | "blocked";
  /** For a slot you have: the booking, and whether it can still be cancelled. */
  bookingId?: string;
  cancellable?: boolean;
  /** For a slot somebody else has. */
  name?: string;
  colour?: string;
  /** For a free slot you may not take: why. */
  reason?: string;
  /** For a slot that has already started: "Now, until 07:20". */
  underWay?: string;
};

type ActionResult = { error?: string };

type Props = {
  rows: SlotRow[];
  /** Class for the row of a slot you have, in the room's colour. */
  mineClassName?: string;
  book: (startsAt: string) => Promise<ActionResult>;
  cancel: (bookingId: string) => Promise<ActionResult>;
};

type Change = { key: string; to: "mine" | "leaving" };
type ShownRow = SlotRow & { leaving?: boolean };

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";
const unreachable = "Couldn't reach Kubbe. Check your connection and try again.";

/** The ladder of slots for one day. Booking is like signing a sheet: your time gets circled. */
export function SlotList({ rows, mineClassName = "bg-fjord/15", book, cancel }: Props) {
  const [, startTransition] = useTransition();
  const [shown, change] = useOptimistic<ShownRow[], Change>(rows, (current, { key, to }) =>
    current.map((row) =>
      row.key !== key ? row : to === "mine" ? { ...row, state: "mine" } : { ...row, leaving: true },
    ),
  );
  // Slots booked during this visit get the circle drawn; ones that were already yours just have it.
  const [drawn, setDrawn] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<{ key: string; message: string } | null>(null);

  /** Run a booking action. A lost connection becomes a message on the row, not a broken screen. */
  function run(key: string, to: Change["to"], action: () => Promise<ActionResult>) {
    setProblem(null);
    startTransition(async () => {
      change({ key, to });
      try {
        const result = await action();
        if (result.error) setProblem({ key, message: result.error });
      } catch {
        setProblem({ key, message: unreachable });
      }
    });
  }

  function onBook(row: SlotRow) {
    setDrawn((previous) => new Set(previous).add(row.key));
    run(row.key, "mine", () => book(row.key));
  }

  function onCancel(row: SlotRow) {
    const bookingId = row.bookingId;
    if (bookingId) run(row.key, "leaving", () => cancel(bookingId));
  }

  return (
    <ol className="flex flex-col">
      {shown.map((row) => {
        const mine = row.state === "mine";
        const pen = row.leaving ? "pen-circle--erase" : drawn.has(row.key) ? "pen-circle--draw" : "";
        return (
          <li
            key={row.key}
            data-testid={`slot-${row.time}`}
            data-state={row.leaving ? "leaving" : row.state}
            className={`border-b-2 border-ink/15 transition-colors duration-300 ${mine && !row.leaving ? mineClassName : ""}`}
          >
            <div className="flex min-h-16 items-center gap-4 px-3 py-2">
              <span className="type-display relative text-3xl tabular-nums">
                {row.time}
                {mine ? (
                  <svg className={`pen-circle ${pen}`} viewBox="0 0 92 44" preserveAspectRatio="none" aria-hidden="true">
                    <path pathLength={1} d="M70 8C50 1 16 3 7 18C0 32 22 42 48 41C74 40 92 30 86 17C81 6 58 3 40 6" />
                  </svg>
                ) : null}
              </span>

              <span className="flex min-w-0 flex-col">
                {row.state === "taken" ? (
                  <span className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.colour }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                ) : null}
                {mine ? <span className="font-bold">You</span> : null}
                {row.state === "free" && !row.underWay ? <span className="text-ink-soft">Free</span> : null}
                {row.state === "blocked" ? <span className="text-ink-soft">{row.reason}</span> : null}
                {row.underWay ? <span className="text-sm font-semibold text-barn">{row.underWay}</span> : null}
              </span>

              {mine && row.cancellable && row.bookingId && !row.leaving ? (
                <button
                  type="button"
                  onClick={() => onCancel(row)}
                  aria-label={`Cancel ${row.time}`}
                  className={`ml-auto h-11 shrink-0 rounded-full border-2 border-ink px-4 font-bold ${focusRing}`}
                >
                  Cancel
                </button>
              ) : null}

              {row.state === "free" ? (
                <button
                  type="button"
                  onClick={() => onBook(row)}
                  aria-label={`Book ${row.time}`}
                  className={`ml-auto h-11 shrink-0 rounded-full bg-ink px-5 font-bold text-paper transition-transform active:scale-[0.97] ${focusRing}`}
                >
                  Book
                </button>
              ) : null}
            </div>

            {problem?.key === row.key ? (
              <p role="alert" data-testid="slot-error" className="px-3 pb-3 font-semibold text-barn">
                {problem.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
