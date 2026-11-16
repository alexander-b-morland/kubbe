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
};

type ActionResult = { error?: string };

type Props = {
  rows: SlotRow[];
  book: (startsAt: string) => Promise<ActionResult>;
  cancel: (bookingId: string) => Promise<ActionResult>;
};

type Change = { key: string; to: "mine" | "leaving" };
type ShownRow = SlotRow & { leaving?: boolean };

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

/** The ladder of slots for one day. Booking is like signing a sheet: your time gets circled. */
export function SlotList({ rows, book, cancel }: Props) {
  const [, startTransition] = useTransition();
  const [shown, change] = useOptimistic<ShownRow[], Change>(rows, (current, { key, to }) =>
    current.map((row) =>
      row.key !== key ? row : to === "mine" ? { ...row, state: "mine" } : { ...row, leaving: true },
    ),
  );
  // Slots booked during this visit get the circle drawn; ones that were already yours just have it.
  const [drawn, setDrawn] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<{ key: string; message: string } | null>(null);

  function onBook(row: SlotRow) {
    setProblem(null);
    setDrawn((previous) => new Set(previous).add(row.key));
    startTransition(async () => {
      change({ key: row.key, to: "mine" });
      const result = await book(row.key);
      if (result.error) setProblem({ key: row.key, message: result.error });
    });
  }

  function onCancel(row: SlotRow) {
    if (!row.bookingId) return;
    const bookingId = row.bookingId;
    setProblem(null);
    startTransition(async () => {
      change({ key: row.key, to: "leaving" });
      const result = await cancel(bookingId);
      if (result.error) setProblem({ key: row.key, message: result.error });
    });
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
            className={`border-b-2 border-ink/15 transition-colors duration-300 ${mine && !row.leaving ? "bg-fjord/10" : ""}`}
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

              {row.state === "taken" ? (
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: row.colour }} />
                  {row.name}
                </span>
              ) : null}

              {mine ? (
                <>
                  <span className="font-bold">You</span>
                  {row.cancellable && row.bookingId && !row.leaving ? (
                    <button
                      type="button"
                      onClick={() => onCancel(row)}
                      aria-label={`Cancel ${row.time}`}
                      className={`ml-auto h-11 rounded-full border-2 border-ink px-4 font-bold ${focusRing}`}
                    >
                      Cancel
                    </button>
                  ) : null}
                </>
              ) : null}

              {row.state === "free" ? (
                <>
                  <span className="text-ink-soft">Free</span>
                  <button
                    type="button"
                    onClick={() => onBook(row)}
                    aria-label={`Book ${row.time}`}
                    className={`ml-auto h-11 rounded-full bg-ink px-5 font-bold text-paper transition-transform active:scale-[0.97] ${focusRing}`}
                  >
                    Book
                  </button>
                </>
              ) : null}

              {row.state === "blocked" ? <span className="text-ink-soft">{row.reason}</span> : null}
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
