"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "copied" | "failed";

const labels: Record<Status, string> = {
  idle: "Share invite link",
  copied: "Link copied",
  failed: "Couldn't copy. Share the code instead",
};

/** Copies the invite link, then says so on the button for a moment. */
export function ShareCode({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
      setStatus("copied");
    } catch {
      // Copying can be blocked by the browser. The code above the button still works.
      setStatus("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="min-h-12 rounded-full bg-ink px-6 py-2 font-bold text-paper outline-none transition-transform focus-visible:ring-4 focus-visible:ring-fjord active:scale-[0.98]"
    >
      <span aria-live="polite">{labels[status]}</span>
    </button>
  );
}
