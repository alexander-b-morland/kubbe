"use client";

// Shown when a screen fails to load. The details go to the server log, not to the person.
export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="type-display text-5xl">That didn&apos;t load</h1>
      <p className="text-lg">Something went wrong on our side. Your bookings are safe. Try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="h-14 rounded-full bg-ink text-lg font-bold text-paper outline-none focus-visible:ring-4 focus-visible:ring-fjord/35"
      >
        Try again
      </button>
    </main>
  );
}
