"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function RootError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ErrorState
        title="Fantasia hit an app-level runtime error"
        description="The page crashed before the workspace could finish loading."
        onRetry={unstable_retry}
        backHref="/"
      />
    </div>
  );
}
