"use client";

import { useState } from "react";
import { providerCatalog, validateConnectionInput } from "@/lib/ai/catalog";
import type { ProviderId } from "@/lib/types";
import { SubmitButton } from "@/components/forms/submit-button";

export function ProviderConnectionForm({
  action,
  submitLabel,
  connectionId,
  initialProvider = "google",
  initialLabel = "",
  initialBaseUrl = "",
  initialEnabled = true,
  keyPlaceholder = "Stored encrypted",
  hasStoredSecret = false,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  connectionId?: string;
  initialProvider?: ProviderId;
  initialLabel?: string;
  initialBaseUrl?: string;
  initialEnabled?: boolean;
  keyPlaceholder?: string;
  hasStoredSecret?: boolean;
}) {
  const [provider, setProvider] = useState<ProviderId>(initialProvider);
  const [label, setLabel] = useState(initialLabel);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [localError, setLocalError] = useState<string | null>(null);

  const definition = providerCatalog[provider];
  const isUntouchedStoredSecret =
    hasStoredSecret &&
    !apiKey.trim() &&
    provider === initialProvider &&
    baseUrl.trim() === initialBaseUrl.trim();
  const validationMessage = isUntouchedStoredSecret
    ? null
    : validateConnectionInput({
        provider,
        baseUrl,
        apiKey,
      });

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        if (!label.trim()) {
          event.preventDefault();
          setLocalError("Give this lane a short label so it is recognizable in the switcher.");
          return;
        }

        if (validationMessage) {
          event.preventDefault();
          setLocalError(validationMessage);
          return;
        }

        setLocalError(null);
      }}
    >
      {connectionId ? <input type="hidden" name="id" value={connectionId} /> : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Label</span>
        <input
          name="label"
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Groq free lane"
          className="w-full rounded-full border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Provider</span>
        <select
          name="provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderId)}
          className="w-full rounded-full border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
        >
          {Object.values(providerCatalog).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs leading-6 text-ink-soft">
          {definition.description}
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Base URL</span>
        <input
          name="base_url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={
            provider === "ollama"
              ? providerCatalog.ollama.defaultBaseUrl
              : "Usually leave blank unless this provider is self-hosted"
          }
          className="w-full rounded-full border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
        />
        <span className="mt-2 block text-xs leading-6 text-ink-soft">
          {provider === "ollama"
            ? "Use this for Ollama Cloud or a custom remote Ollama-compatible endpoint."
            : "Most hosted providers use their default endpoint. Only fill this when you know you need an override."}
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">API key</span>
        <input
          type="password"
          name="api_key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPlaceholder}
          className="w-full rounded-full border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
        />
        <span className="mt-2 block text-xs leading-6 text-ink-soft">
          {provider === "ollama"
            ? "Ollama Cloud needs a key; many remote self-hosted Ollama endpoints do not."
            : "Fantasia encrypts the key before storing it in Supabase."}
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-full border border-border bg-white px-4 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enabled for thread selection
      </label>

      <div aria-live="polite" className="space-y-2">
        {validationMessage ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {validationMessage}
          </p>
        ) : null}
        {localError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {localError}
          </p>
        ) : null}
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
