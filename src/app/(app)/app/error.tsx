"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function WorkspaceError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="The workspace view failed to render"
      description="Fantasia couldn’t finish loading this workspace surface."
      onRetry={unstable_retry}
      backHref="/app"
    />
  );
}
