"use client";

import { useActionState, useEffect } from "react";
import type { UserPersonaRecord } from "@/lib/types";
import { SubmitButton } from "@/components/forms/submit-button";
import { JsonPortabilityPanel } from "@/components/forms/json-portability-panel";
import {
  emptyPersonaFormState,
  type PersonaFormState,
} from "@/components/personas/persona-form-state";
import { useLocalDraft } from "@/components/forms/use-local-draft";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes-guard";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
      <span className="mb-1 block text-xs font-medium text-on-surface">{label}</span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[5rem] w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm leading-6 text-on-surface outline-none focus:border-primary-container"
      />
      {helper ? <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{helper}</span> : null}
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
  action: (
    state: PersonaFormState,
    formData: FormData,
  ) => Promise<PersonaFormState>;
  saved?: boolean;
}) {
  const [formState, formAction] = useActionState(action, emptyPersonaFormState);
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

  const { confirmRequest, clearConfirm } = useUnsavedChangesGuard(
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
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={editing?.id ?? ""} />

      {formState.formError ? (
        <div className="rounded border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
          {formState.formError}
        </div>
      ) : null}

      {hasStoredDraft ? (
        <div className="rounded border border-primary-container/30 bg-primary-container/10 px-3 py-3 text-xs text-primary-container">
          <p className="font-semibold">Local draft found.</p>
          <p className="mt-1 leading-4">Restore or discard before editing.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={restoreDraft} className="rounded bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container">
              Restore
            </button>
            <button type="button" onClick={discardDraft} className="rounded border border-primary-container/30 px-3 py-1 text-xs font-semibold">
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {restoredFromDraft ? (
        <div aria-live="polite" className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs text-status-success">
          Draft restored. Save when ready.
        </div>
      ) : null}

      <JsonPortabilityPanel
        key={`persona-portability-${editing?.id ?? "new"}`}
        kind="persona"
        currentData={personaDraftToPortableData(draft)}
        onImport={importPersonaData}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-on-surface">Name</span>
        <input
          name="name"
          required
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
          placeholder="Late-night version of me"
        />
        {formState.fieldErrors.name ? (
          <span className="mt-1 block text-[11px] text-status-warning">{formState.fieldErrors.name}</span>
        ) : null}
      </label>

      <TextField label="Identity" name="identity" value={draft.identity} helper="Who the user is in the story." onChange={(value) => update("identity", value)} />
      <TextField label="Backstory" name="backstory" value={draft.backstory} helper="Context the character can assume." onChange={(value) => update("backstory", value)} />
      <TextField label="Voice style" name="voice_style" value={draft.voice_style} helper="How the user speaks and emotes." onChange={(value) => update("voice_style", value)} />
      <TextField label="Goals" name="goals" value={draft.goals} helper="What this persona wants from the scene." onChange={(value) => update("goals", value)} />
      <TextField label="Boundaries" name="boundaries" value={draft.boundaries} helper="Limits and emotional red lines." onChange={(value) => update("boundaries", value)} />
      <TextField label="Private notes" name="private_notes" value={draft.private_notes} helper="Notes to yourself, not public-facing." onChange={(value) => update("private_notes", value)} />

      <label className="flex items-center gap-2 rounded border border-border-subtle bg-surface-container px-3 py-2 text-xs text-on-surface">
        <input
          type="checkbox"
          name="is_default"
          checked={draft.is_default}
          onChange={(event) => update("is_default", event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--primary-container)]"
        />
        Make default for new threads
      </label>

      <div className="sticky bottom-4 z-20 rounded-lg border border-border-subtle bg-surface-container-low/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface">
              {isDirty ? "Unsaved changes." : "In sync."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Personas shape every new thread.
            </p>
          </div>
          <SubmitButton className="shrink-0 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
            {editing ? "Save persona" : "Create persona"}
          </SubmitButton>
        </div>
      </div>
      <ConfirmationDialog request={confirmRequest} onClose={clearConfirm} />
    </form>
  );
}
