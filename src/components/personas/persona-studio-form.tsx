"use client";

import { useEffect } from "react";
import type { UserPersonaRecord } from "@/lib/types";
import { SubmitButton } from "@/components/forms/submit-button";
import { JsonPortabilityPanel } from "@/components/forms/json-portability-panel";
import { useLocalDraft } from "@/components/forms/use-local-draft";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes-guard";
import {
  createPersonaDraft,
  personaDraftToPortableData,
  portablePersonaDataToDraft,
  type PersonaDraft,
} from "@/lib/portability/editor-drafts";
import type { OpenFantasiaPersonaData } from "@/lib/portability/openfantasia-json";

function TextField({
  label,
  name,
  value,
  rows = 4,
  helper,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  rows?: number;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[6.5rem] w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-brand"
      />
      {helper ? <span className="mt-2 block text-xs leading-6 text-ink-soft">{helper}</span> : null}
    </label>
  );
}

export function PersonaStudioForm({
  editing,
  personaCount,
  action,
  saved = false,
}: {
  editing: UserPersonaRecord | null;
  personaCount: number;
  action: (formData: FormData) => Promise<void>;
  saved?: boolean;
}) {
  const {
    value: draft,
    setValue: setDraft,
    hasStoredDraft,
    restoredFromDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    isDirty,
  } = useLocalDraft<PersonaDraft>({
    storageKey: `fantasia:persona-draft:${editing?.id ?? "new"}`,
    initialValue: createPersonaDraft(editing, personaCount),
  });

  useUnsavedChangesGuard(
    isDirty,
    "You have unsaved persona changes. Leave this page and lose the current draft?",
  );

  useEffect(() => {
    if (saved) {
      clearDraft();
    }
  }, [clearDraft, saved]);

  function update<K extends keyof PersonaDraft>(key: K, value: PersonaDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function importPersonaData(data: OpenFantasiaPersonaData) {
    setDraft((current) => portablePersonaDataToDraft(data, current.is_default));
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="id" value={editing?.id ?? ""} />

      {hasStoredDraft ? (
        <div className="rounded-[1.6rem] border border-accent/25 bg-accent/10 px-5 py-4 text-sm text-accent">
          <p className="font-semibold">Local persona draft found.</p>
          <p className="mt-2 leading-7">
            Restore the unsaved version from this device or discard it before you continue.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Restore local draft
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-full border border-accent/30 px-4 py-2 text-sm font-semibold transition hover:border-accent"
            >
              Discard it
            </button>
          </div>
        </div>
      ) : null}

      {restoredFromDraft ? (
        <div aria-live="polite" className="rounded-[1.6rem] bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          Local persona draft restored. Save when it feels right.
        </div>
      ) : null}

      <JsonPortabilityPanel
        kind="persona"
        currentData={personaDraftToPortableData(draft)}
        onImport={importPersonaData}
      />

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Name</span>
        <input
          name="name"
          required
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          className="w-full rounded-full border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
          placeholder="Late-night version of me"
        />
      </label>

      <TextField
        label="Identity"
        name="identity"
        value={draft.identity}
        helper="Who the user is in the story right now."
        onChange={(value) => update("identity", value)}
      />
      <TextField
        label="Backstory"
        name="backstory"
        value={draft.backstory}
        helper="Context the character can assume without forcing it into every line."
        onChange={(value) => update("backstory", value)}
      />
      <TextField
        label="Voice style"
        name="voice_style"
        value={draft.voice_style}
        helper="How the user tends to speak, emote, and respond under pressure."
        onChange={(value) => update("voice_style", value)}
      />
      <TextField
        label="Goals"
        name="goals"
        value={draft.goals}
        helper="What this version of the user wants from the scene."
        onChange={(value) => update("goals", value)}
      />
      <TextField
        label="Boundaries"
        name="boundaries"
        value={draft.boundaries}
        helper="Useful guardrails, limits, and emotional red lines."
        onChange={(value) => update("boundaries", value)}
      />
      <TextField
        label="Private notes"
        name="private_notes"
        value={draft.private_notes}
        helper="Notes to yourself about the persona, not public-facing prose."
        onChange={(value) => update("private_notes", value)}
      />

      <label className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="is_default"
          checked={draft.is_default}
          onChange={(event) => update("is_default", event.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
        Make this the default persona for new threads
      </label>

      <div className="sticky bottom-24 z-20 rounded-[1.8rem] border border-border bg-[#fff8ef]/96 px-5 py-4 shadow-[0_18px_40px_rgba(36,20,12,0.12)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isDirty ? "This persona is only saved locally until you commit it." : "Server copy is synced with this editor."}
            </p>
            <p className="mt-1 text-xs leading-6 text-ink-soft">
              Personas shape every new thread, so it is worth making this one explicit.
            </p>
          </div>
          <SubmitButton className="shrink-0">
            {editing ? "Save persona" : "Create persona"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
