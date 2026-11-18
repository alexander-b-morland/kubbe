import type { ReactNode } from "react";

/**
 * Text with a pen line through all of it, for something that is done or bought.
 * With `draw`, the line draws itself: use it for what was ticked off a moment ago.
 */
export function Struck({ children, draw = false, className = "" }: { children: ReactNode; draw?: boolean; className?: string }) {
  return (
    <span className={`relative inline-block max-w-full break-words ${className}`}>
      {children}
      <svg className={`strike ${draw ? "strike--draw" : ""}`} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength={1} d="M0 12C20 7 42 15 60 10C76 6 90 13 100 9" />
      </svg>
    </span>
  );
}

/** Whether something happened so recently that its pen stroke should still be drawn. */
export const isFresh = (at: Date | null | undefined, now: Date) => (at ? now.getTime() - at.getTime() < 20_000 : false);
