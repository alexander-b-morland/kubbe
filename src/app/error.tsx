"use client";

import { KubbeLogo } from "@/components/logo/kubbe-logo";

const button =
  "flex h-14 items-center justify-center rounded-full text-lg font-bold outline-none focus-visible:ring-4 focus-visible:ring-fjord";

// Shown when a screen fails to load. The details go to the server log, not to the person.
export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <KubbeLogo label="" className="w-32" />
      <h1 className="type-display text-5xl">That didn&apos;t load</h1>
      <p className="text-lg">Something went wrong on our side. Your bookings are safe. Try again in a moment.</p>
      <button type="button" onClick={reset} className={`${button} bg-ink text-paper`}>
        Try again
      </button>
      {/* A plain link, not the router: it must work even when the app itself is what broke. */}
      <a href="/home" className={`${button} border-2 border-ink`}>
        Go to Home
      </a>
    </main>
  );
}
