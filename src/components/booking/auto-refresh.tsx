"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps a screen current: refetches when you come back to it, and now and then while it is open. */
export function AutoRefresh({ everySeconds = 20 }: { everySeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everySeconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everySeconds]);

  return null;
}
