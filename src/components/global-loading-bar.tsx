"use client";

import { useNavTransition } from "@/components/transition-provider";

/**
 * A thin progress bar pinned to the very top of the viewport.
 * Visible only when a React transition (router.refresh) is in flight.
 * Uses a CSS animation so the bar feels alive even if the fetch is slow.
 */
export function GlobalLoadingBar() {
  const { isNavigating } = useNavTransition();

  if (!isNavigating) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Loading"
      data-testid="global-loading-bar"
      className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
    >
      <div className="loading-bar-track h-full w-full bg-brand/30">
        <div className="loading-bar-fill h-full bg-brand" />
      </div>
    </div>
  );
}
