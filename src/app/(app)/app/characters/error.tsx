"use client";

import { ErrorState } from "@/components/feedback/page-state";

export default function CharactersError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="Could not load your character studio"
      description="The character library or builder failed before the studio finished rendering."
      onRetry={unstable_retry}
      backHref="/app"
      debugDigest={process.env.NODE_ENV === "development" ? error.digest : undefined}
    />
  );
}
