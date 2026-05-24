"use client";

/**
 * A thin progress bar pinned to the very top of the viewport.
 * Currently unused — kept as a placeholder for future navigation indicators.
 */
export function GlobalLoadingBar({ visible = false }: { visible?: boolean }) {
  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Loading"
      data-testid="global-loading-bar"
      className="fixed inset-x-0 top-0 z-[100] h-[2px] overflow-hidden"
    >
      <div className="loading-bar-track h-full w-full bg-primary-container/30">
        <div className="loading-bar-fill h-full bg-primary-container" />
      </div>
    </div>
  );
}
