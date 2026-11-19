"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import "./booking.css";
import { m } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

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
  /** For a free slot you may not take: why. Empty when the reason is said once above the list. */
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

// What a press does to a row before the server has answered. "back" undoes it at once
// when the server says no, so a refused booking never keeps looking booked.
type Change = { key: string; to: "booking" | "leaving" | "back" };
type ShownRow = SlotRow & { waiting?: "booking" | "leaving" };

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const unreachable = m("Couldn't reach Kubbe. Check your connection and try again.");

/** The ladder of slots for one day. Booking is like signing a sheet: your time gets circled. */
export function SlotList({ rows, mineClassName = "bg-fjord/25", book, cancel }: Props) {
  const t = useT();
  const [, startTransition] = useTransition();
  const [shown, change] = useOptimistic<ShownRow[], Change>(rows, (current, { key, to }) =>
    current.map((row) => {
      if (row.key !== key) return row;
      if (to === "back") return { ...row, waiting: undefined };
      return { ...row, waiting: to };
    }),
  );
  // Slots booked during this visit get the circle drawn; ones that were already yours just have it.
  const [drawn, setDrawn] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<{ key: string; message: string } | null>(null);
  // Cancelling asks first: one slip of the thumb should not give a shower away.
  const [asking, setAsking] = useState<string | null>(null);
  // Said aloud for people who cannot see the row change.
  const [said, setSaid] = useState("");
  // After a press, the keyboard stays on the row that was pressed.
  const acted = useRef<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const key = acted.current;
    if (!key) return;
    const control = list.current?.querySelector<HTMLElement>(`[data-slot="${key}"] button`);
    if (control && document.activeElement === document.body) control.focus();
  }, [rows, asking]);

  /** Run a booking action. A lost connection becomes a message on the row, not a broken screen. */
  function run(row: SlotRow, to: "booking" | "leaving", action: () => Promise<ActionResult>) {
    setProblem(null);
    acted.current = row.key;
    startTransition(async () => {
      change({ key: row.key, to });
      let message: string | undefined;
      try {
        message = (await action()).error;
      } catch {
        message = unreachable;
      }
      if (message) {
        change({ key: row.key, to: "back" });
        setProblem({ key: row.key, message });
        setDrawn((previous) => new Set([...previous].filter((key) => key !== row.key)));
        setSaid(message);
      } else {
        setSaid(to === "booking" ? t`Booked ${row.time}.` : t`Cancelled ${row.time}.`);
      }
    });
  }

  function onBook(row: SlotRow) {
    setDrawn((previous) => new Set(previous).add(row.key));
    run(row, "booking", () => book(row.key));
  }

  function onCancel(row: SlotRow) {
    const bookingId = row.bookingId;
    setAsking(null);
    if (bookingId) run(row, "leaving", () => cancel(bookingId));
  }

  return (
    <>
      <p role="status" className="sr-only">
        {said}
      </p>
      <ol ref={list} className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8">
        {shown.map((row) => {
          const booking = row.waiting === "booking";
          const leaving = row.waiting === "leaving";
          const mine = row.state === "mine" || booking;
          const pen = leaving ? "pen-circle--erase" : drawn.has(row.key) ? "pen-circle--draw" : "";
          const question = asking === row.key && row.state === "mine" && !leaving;
          return (
            <li
              key={row.key}
              data-slot={row.key}
              data-testid={`slot-${row.time}`}
              data-state={leaving ? "leaving" : booking ? "booking" : row.state}
              className={`border-b-2 border-ink/15 transition-colors duration-300 ${mine && !leaving ? mineClassName : ""}`}
            >
              <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2 pr-3 pl-5">
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
                  {booking ? <span className="font-semibold">{t("Booking…")}</span> : null}
                  {leaving ? <span className="font-semibold">{t("Cancelling…")}</span> : null}
                  {row.state === "mine" && !leaving ? <span className="font-bold">{t("You")}</span> : null}
                  {row.state === "free" && !booking && !row.underWay ? <span className="text-ink-soft">{t("Free")}</span> : null}
                  {row.state === "blocked" && row.reason ? <span className="text-ink-soft">{row.reason}</span> : null}
                  {row.underWay && !booking ? <span className="text-sm font-semibold">{row.underWay}</span> : null}
                </span>

                {question ? (
                  <span className="ml-auto flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setAsking(null)} className={`h-11 rounded-full border-2 border-ink px-4 font-bold ${focusRing}`}>
                      {t("Keep it")}
                    </button>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => onCancel(row)}
                      className={`h-11 rounded-full border-2 border-barn bg-barn px-4 font-bold text-paper ${focusRing}`}
                    >
                      {t`Cancel ${row.time}`}?
                    </button>
                  </span>
                ) : row.state === "mine" && row.cancellable && row.bookingId && !leaving ? (
                  <button
                    type="button"
                    onClick={() => {
                      acted.current = row.key;
                      setAsking(row.key);
                    }}
                    aria-label={t`Cancel ${row.time}`}
                    className={`ml-auto h-11 shrink-0 rounded-full border-2 border-ink px-4 font-bold ${focusRing}`}
                  >
                    {t("Cancel")}
                  </button>
                ) : null}

                {row.state === "free" && !booking ? (
                  <button
                    type="button"
                    onClick={() => onBook(row)}
                    aria-label={t`Book ${row.time}`}
                    className={`area-button ml-auto h-11 shrink-0 rounded-full px-5 font-bold transition-transform active:scale-[0.97] ${focusRing}`}
                  >
                    {t("Book")}
                  </button>
                ) : null}
              </div>

              {problem?.key === row.key ? (
                <p role="alert" data-testid="slot-error" className="px-5 pb-3 font-semibold text-barn">
                  {t.loose(problem.message)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
