"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";

type Result = { error?: string; saved?: boolean } | undefined;

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-offset-2 focus-visible:ring-offset-note";

/**
 * The red cross in the corner of a note its author (or an admin) may take down. It asks
 * first, on the note itself, with a way back.
 */
export function TakeDown({ about, action }: { about: string; action: () => Promise<Result> }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState<Result>(action, undefined);
  return (
    <form action={formAction} className="contents">
      {asking ? (
        // Its own element with its own key: reusing the cross would submit on the first press (see CLAUDE.md).
        <div key="ask" role="group" aria-label={t`Take down: ${about}`} className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 rounded-sm bg-paper/95 p-3 text-center">
          <p className="font-semibold">{t("Take it down?")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setAsking(false)} className={`min-h-11 rounded-full border-2 border-ink px-4 text-sm font-bold ${ring}`}>
              {t("Keep it")}
            </button>
            <button
              type="submit"
              autoFocus
              aria-disabled={pending}
              className={`min-h-11 rounded-full border-2 border-barn bg-barn px-4 text-sm font-bold text-paper ${ring} ${pending ? "opacity-70" : ""}`}
            >
              {pending ? t("Working…") : t("Take down")}
            </button>
          </div>
          {state?.error ? <p role="alert" className="text-sm font-semibold text-barn">{t.loose(state.error)}</p> : null}
        </div>
      ) : (
        <button
          key="cross"
          type="button"
          onClick={() => setAsking(true)}
          aria-label={t`Take down: ${about}`}
          className={`absolute -top-2 -right-2 z-[1] flex size-8 items-center justify-center rounded-full bg-barn text-paper shadow-[1px_2px_0_0_rgba(30,42,68,0.25)] ${ring}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <path d="M6 6.5C10 10.5 14 14 18 17.5M17.5 6C14 10 10 14 6.5 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </form>
  );
}

/** A thumbs-up, drawn in the same pen as everything else. */
function Thumb({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0">
      <path d="M3.5 10.5h3.5v9.5H3.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M7 10.5C8.5 8.5 10 6.2 10.6 3.6C12.3 3.4 13.4 4.8 13 6.7L12.4 9.8H18.3C19.6 9.8 20.5 11 20.2 12.2L18.7 18.6C18.5 19.5 17.7 20 16.8 20H7"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.25 : 0}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Seen it, agreed": one thumbs-up per person per note. Pressing it again takes it back.
 * The count changes at once; the server catches up behind it.
 */
export function ThumbsUp({ count, mine, who, about, action }: { count: number; mine: boolean; who: string; about: string; action: (on: boolean) => Promise<Result> }) {
  const t = useT();
  const [shown, setShown] = useOptimistic({ count, mine }, (_current, next: { count: number; mine: boolean }) => next);
  const [, startTransition] = useTransition();
  const press = () =>
    startTransition(async () => {
      const on = !shown.mine;
      setShown({ count: shown.count + (on ? 1 : -1), mine: on });
      await action(on);
    });
  return (
    <button
      type="button"
      onClick={press}
      aria-pressed={shown.mine}
      aria-label={t`Thumbs up: ${about}`}
      title={who || undefined}
      data-testid="thumbs-up"
      className={`flex min-h-9 items-center gap-1 rounded-full border-2 px-2.5 text-sm font-bold ${ring} ${shown.mine ? "border-ink bg-ink text-paper" : "border-ink/40"}`}
    >
      <Thumb filled={shown.mine} />
      {shown.count > 0 ? <span>{shown.count}</span> : null}
    </button>
  );
}
