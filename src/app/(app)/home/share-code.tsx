"use client";

import { useEffect, useState } from "react";
import { m } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

type Status = "idle" | "copied" | "failed";

const labels: Record<Status, string> = {
  idle: m("Share invite link"),
  copied: m("Link copied"),
  failed: m("Couldn't copy. Share the code instead"),
};

/** Copies the invite link, then says so on the button for a moment. */
export function ShareCode({ code, small = false }: { code: string; small?: boolean }) {
  const t = useT();
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
      className={`rounded-full bg-ink font-bold text-paper outline-none transition-transform focus-visible:ring-4 focus-visible:ring-fjord active:scale-[0.98] ${small ? "min-h-10 px-4 py-1.5 text-sm" : "min-h-12 px-6 py-2"}`}
    >
      <span aria-live="polite">{t(labels[status])}</span>
    </button>
  );
}
