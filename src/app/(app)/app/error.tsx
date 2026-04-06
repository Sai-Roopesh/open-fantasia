"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="The workspace view failed to render"
      description="Fantasia couldn’t finish loading this workspace surface."
      onRetry={reset}
      backHref="/app"
    />
  );
}
