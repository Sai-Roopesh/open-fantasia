"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function ThreadsError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="Could not load your thread library"
      description="The thread list failed while gathering recent scenes and filters."
      onRetry={unstable_retry}
      backHref="/app"
    />
  );
}
