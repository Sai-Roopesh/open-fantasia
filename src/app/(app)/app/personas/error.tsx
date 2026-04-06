"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function PersonasError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="Could not load your persona library"
      description="The persona list or builder failed before the page could finish rendering."
      onRetry={unstable_retry}
      backHref="/app"
    />
  );
}
