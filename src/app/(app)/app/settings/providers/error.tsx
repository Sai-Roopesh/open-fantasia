"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function ProviderSettingsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="Could not load your provider lanes"
      description="Provider health, cached models, or lane settings failed before the page finished rendering."
      onRetry={unstable_retry}
      backHref="/app"
      debugDigest={process.env.NODE_ENV === "development" ? error.digest : undefined}
    />
  );
}
