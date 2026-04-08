"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useNavTransition } from "@/components/transition-provider";
import { cn } from "@/lib/utils";

type ProviderResponsePayload = {
  error?: string;
  message?: string;
  count?: number;
};

export function ProviderHealthActions({
  connectionId,
}: {
  connectionId: string;
}) {
  const { refreshWithTransition } = useNavTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function runRequest(url: string, mode: "test" | "refresh") {
    if (mode === "test") {
      setTesting(true);
    } else {
      setRefreshing(true);
    }

    setMessage(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const payload = (await response.json()) as ProviderResponsePayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setMessage(
        mode === "refresh"
          ? payload.message ?? `Loaded ${payload.count ?? 0} models`
          : payload.message ?? "Connection looks healthy.",
      );
      refreshWithTransition();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      if (mode === "test") {
        setTesting(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={testing || refreshing}
        onClick={() => runRequest("/api/providers/test", "test")}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand disabled:opacity-60"
        data-testid="provider-test-connection"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Test connection
      </button>

      <button
        type="button"
        disabled={testing || refreshing}
        onClick={() => runRequest("/api/providers/discover", "refresh")}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand disabled:opacity-60"
        data-testid="provider-refresh-models"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
        />
        Refresh models
      </button>

      {message ? <p className="text-xs leading-6 text-ink-soft">{message}</p> : null}
    </div>
  );
}
