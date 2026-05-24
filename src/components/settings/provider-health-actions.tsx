"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
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
  const router = useRouter();
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
      router.refresh();
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
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={testing || refreshing}
        onClick={() => runRequest("/api/providers/test", "test")}
        className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface disabled:opacity-50"
        data-testid="provider-test-connection"
      >
        <ShieldCheck className="h-3 w-3" />
        Test
      </button>

      <button
        type="button"
        disabled={testing || refreshing}
        onClick={() => runRequest("/api/providers/discover", "refresh")}
        className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface disabled:opacity-50"
        data-testid="provider-refresh-models"
      >
        <RefreshCw
          className={cn("h-3 w-3", refreshing && "animate-spin")}
        />
        Refresh
      </button>

      {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
