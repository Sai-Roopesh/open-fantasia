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
      className="space-y-3"
      onSubmit={(event) => {
        if (!label.trim()) {
          event.preventDefault();
          setLocalError("Give this lane a label.");
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
        <span className="mb-1 block text-xs font-medium text-on-surface">Label</span>
        <input
          name="label"
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Groq free lane"
          className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-on-surface">Provider</span>
        <select
          name="provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderId)}
          className="w-full rounded border border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
        >
          {Object.values(providerCatalog).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          {definition.description}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-on-surface">Base URL</span>
        <input
          name="base_url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={
            provider === "ollama"
              ? providerCatalog.ollama.defaultBaseUrl
              : "Leave blank for default endpoint"
          }
          className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
        />
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          {provider === "ollama"
            ? "Ollama Cloud or custom remote endpoint."
            : "Override only when needed."}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-on-surface">API key</span>
        <input
          type="password"
          name="api_key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPlaceholder}
          className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
        />
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          {provider === "ollama"
            ? "Ollama Cloud needs a key; self-hosted may not."
            : "Encrypted before storage."}
        </span>
      </label>

      <label className="flex items-center gap-2 rounded border border-border-subtle bg-surface-container px-3 py-2 text-xs text-on-surface">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--primary-container)]"
        />
        Enabled for thread selection
      </label>

      <div aria-live="polite" className="space-y-2">
        {validationMessage ? (
          <p className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
            {validationMessage}
          </p>
        ) : null}
        {localError ? (
          <p className="rounded border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
            {localError}
          </p>
        ) : null}
      </div>

      <SubmitButton className="rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">{submitLabel}</SubmitButton>
    </form>
  );
}
