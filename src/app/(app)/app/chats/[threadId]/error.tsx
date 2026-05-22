"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function ChatThreadError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="This thread hit a rendering error"
      description="The transcript or continuity view failed while opening the thread."
      onRetry={unstable_retry}
      backHref="/app/threads"
    />
  );
}
