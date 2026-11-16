"use client";

import { useState, useTransition } from "react";
import type { BookingActionResult } from "@/lib/booking/actions";

/** One button that books one specific slot, for suggestions such as "dryer after your wash". */
export function QuickBook({
  label,
  pendingLabel,
  book,
}: {
  label: string;
  pendingLabel: string;
  book: () => Promise<BookingActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-disabled={pending}
        onClick={() => {
          if (pending) return;
          setError(undefined);
          startTransition(async () => {
            try {
              const result = await book();
              if (result.error) setError(result.error);
            } catch {
              setError("Couldn't reach Kubbe. Check your connection and try again.");
            }
          });
        }}
        className={`h-11 w-fit rounded-full bg-ink px-5 font-bold text-paper outline-none focus-visible:ring-4 focus-visible:ring-fjord ${pending ? "opacity-70" : ""}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? (
        <p role="alert" className="font-semibold text-barn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
