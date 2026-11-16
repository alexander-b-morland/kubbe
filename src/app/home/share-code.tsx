"use client";

import { useState } from "react";

/** Share the join link through the phone's share sheet, or copy it where there is none. */
export function ShareCode({ code, householdName }: { code: string; householdName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/join/${code}`;
    const text = `Join ${householdName} on Kubbe`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kubbe", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The person closed the share sheet, or copying is blocked: nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="h-12 rounded-full bg-ink px-6 font-bold text-paper outline-none transition-transform focus-visible:ring-4 focus-visible:ring-fjord/35 active:scale-[0.98]"
    >
      <span aria-live="polite">{copied ? "Link copied" : "Share invite link"}</span>
    </button>
  );
}
