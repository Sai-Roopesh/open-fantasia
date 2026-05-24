"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { buildCharacterPortraitStatusCopy } from "@/lib/characters/portrait-status";
import type { CharacterBundle } from "@/lib/data/characters";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/forms/submit-button";
import { JsonPortabilityPanel } from "@/components/forms/json-portability-panel";
import { useLocalDraft } from "@/components/forms/use-local-draft";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes-guard";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  characterDraftToPortableData,
  createCharacterDraft,
  portableCharacterDataToDraft,
  type CharacterDraft,
} from "@/lib/portability/editor-drafts";
import type { OpenFantasiaCharacterData } from "@/lib/portability/openfantasia-json";

const tabs = [
  { id: "story", label: "Story" },
  { id: "voice", label: "Voice" },
  { id: "starters", label: "Starters" },
  { id: "examples", label: "Examples" },
] as const;

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

export function CharacterStudioForm({
  editing,
  action,
  portraitPreviewUrl,
  regeneratePortraitAction,
  saved,
}: {
  editing: CharacterBundle | null;
  action: (formData: FormData) => Promise<void>;
  portraitPreviewUrl: string | null;
  regeneratePortraitAction?: (formData: FormData) => Promise<void>;
  saved?: boolean;
}) {
  const initialDraft = useMemo(() => createCharacterDraft(editing), [editing]);
  const storageKey = `fantasia:character-draft:${editing?.character.id ?? "new"}`;
  const {
    value: draft,
    setValue: setDraft,
    hasStoredDraft,
    restoredFromDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    isDirty,
  } = useLocalDraft<CharacterDraft>({
    storageKey,
    initialValue: initialDraft,
  });
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["id"]>("story");

  const { confirmRequest, clearConfirm } = useUnsavedChangesGuard(
    isDirty,
    "You have unsaved character changes. Leave this page and lose the current draft?",
  );

  useEffect(() => {
    if (saved) {
      clearDraft();
    }
  }, [clearDraft, saved]);

  const sectionProgress = {
    story: Number(Boolean(draft.name.trim() && (draft.story.trim() || draft.core_persona.trim() || draft.greeting.trim()))),
    voice: Number(
      Boolean(
        draft.style_rules.trim() ||
          draft.definition.trim() ||
          draft.negative_guidance.trim(),
      ),
    ),
    starters: Number(draft.starters.some((starter) => starter.trim())),
    examples: Number(
      draft.examples.some(
        (example) => example.user.trim() || example.character.trim(),
      ),
    ),
  } as const;

  const completedSections = Object.values(sectionProgress).filter(Boolean).length;
  const portraitStatus = editing?.character.portrait_status ?? "idle";
  const portraitStatusLabel = buildCharacterPortraitStatusCopy(portraitStatus);
  const savedAppearance = editing?.character.appearance.trim() ?? "";
  const draftAppearance = draft.appearance.trim();
  const hasUnsavedPortraitInputs =
    Boolean(editing) &&
    (draft.name.trim() !== editing?.character.name.trim() ||
      draftAppearance !== savedAppearance ||
      draft.core_persona.trim() !== editing?.character.core_persona.trim());

  function update<K extends keyof CharacterDraft>(key: K, nextValue: CharacterDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  function importCharacterData(data: OpenFantasiaCharacterData) {
    setDraft(portableCharacterDataToDraft(data));
  }

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={editing?.character.id ?? ""} />

      {hasStoredDraft ? (
        <div className="rounded border border-primary-container/30 bg-primary-container/10 px-3 py-3 text-xs text-primary-container">
          <p className="font-semibold">Local draft found.</p>
          <p className="mt-1 leading-4">
            Restore or discard before editing.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded border border-primary-container/30 px-3 py-1 text-xs font-semibold"
            >
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
        key={`character-portability-${editing?.character.id ?? "new"}`}
        kind="character"
        currentData={characterDraftToPortableData(draft)}
        onImport={importCharacterData}
      />

      <div className="rounded-lg border border-border-subtle bg-surface-container-low p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold",
                activeTab === tab.id
                  ? "bg-primary-container text-on-primary-container"
                  : "text-muted-foreground hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              {tab.label}
              {sectionProgress[tab.id] ? (
                <span className="ml-1 text-[9px] uppercase tracking-[0.05em] opacity-75">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded bg-surface-container px-3 py-2 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
          <span>{completedSections}/4 sections</span>
          <span>{isDirty ? "unsaved" : "saved"}</span>
        </div>
      </div>

      {/* ── Tab 1: Story ── */}
      <div className={cn(activeTab !== "story" && "hidden", "space-y-3")}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-on-surface">Name</span>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
            placeholder="Captain Mirelle"
          />
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            The name used in every response.
          </span>
        </label>

        <TextField
          label="Story"
          name="story"
          value={draft.story}
          rows={8}
          helper="World, setting, current situation, and the character's relationship to the user."
          onChange={(value) => update("story", value)}
        />

        <TextField
          label="Personality"
          name="core_persona"
          value={draft.core_persona}
          rows={5}
          helper="Values, contradictions, fears, humor — the emotional texture to sustain."
          onChange={(value) => update("core_persona", value)}
        />

        <TextField
          label="Greeting"
          name="greeting"
          value={draft.greeting}
          rows={4}
          helper="The opening line that sets the scene."
          onChange={(value) => update("greeting", value)}
        />

        <TextField
          label="Appearance"
          name="appearance"
          value={draft.appearance}
          rows={4}
          helper="Face, hair, build, clothing for portrait generation. Not sent to the AI."
          onChange={(value) => update("appearance", value)}
        />

        <section className="rounded-lg border border-border-subtle bg-surface-container-low p-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Portrait</p>
              <p className="mt-1 text-sm font-medium text-on-surface">{portraitStatusLabel}</p>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">
                {!draftAppearance
                  ? "Add an appearance description and save to queue a portrait."
                  : !editing
                    ? "Save first to queue portrait generation."
                    : portraitStatus === "pending"
                      ? "Generating... Refresh to check."
                      : portraitStatus === "ready"
                        ? "Portrait ready."
                        : portraitStatus === "failed"
                          ? "Generation failed. Try regenerating."
                          : "Save changes to generate a portrait."}
              </p>
              {hasUnsavedPortraitInputs ? (
                <p className="mt-1 text-[11px] text-status-warning">
                  Unsaved changes won&apos;t affect the portrait until saved.
                </p>
              ) : null}
            </div>

            {editing && regeneratePortraitAction ? (
              <button
                type="submit"
                formAction={regeneratePortraitAction}
                disabled={!savedAppearance}
                className="self-start rounded bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface disabled:opacity-50"
              >
                Regenerate portrait
              </button>
            ) : null}
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background-base">
            {portraitPreviewUrl && portraitStatus === "ready" ? (
              <Image
                src={portraitPreviewUrl}
                alt={`${((editing?.character.name ?? draft.name) || "Character")} portrait`}
                width={512}
                height={512}
                className="aspect-square w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex aspect-square items-center justify-center px-4 text-center text-xs text-muted-foreground">
                {!draftAppearance
                  ? "No appearance prompt yet."
                  : portraitStatus === "pending"
                    ? "Generating..."
                    : portraitStatus === "failed"
                      ? "Last attempt failed."
                      : "Portrait will generate after save."}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Tab 2: Voice ── */}
      <div className={cn(activeTab !== "voice" && "hidden", "space-y-3")}>
        <TextField
          label="Writing style"
          name="style_rules"
          value={draft.style_rules}
          rows={5}
          helper="Prose cadence, formatting, humor, restraint — voice rules the model should follow."
          onChange={(value) => update("style_rules", value)}
        />
        <TextField
          label="Behavior rules"
          name="definition"
          value={draft.definition}
          rows={8}
          helper="Hard constraints that survive long chats: priorities, habits, immutable reactions."
          onChange={(value) => update("definition", value)}
        />
        <TextField
          label="Boundaries"
          name="negative_guidance"
          value={draft.negative_guidance}
          rows={5}
          helper="What the character must never do, say, or become."
          onChange={(value) => update("negative_guidance", value)}
        />
      </div>

      {/* ── Tab 3: Starters ── */}
      <div className={cn(activeTab !== "starters" && "hidden", "space-y-3")}>
        <p className="text-xs text-muted-foreground">
          Scene-openers, not generic greetings.
        </p>
        {draft.starters.map((starter, index) => (
          <div key={`starter-${index}`} className="flex gap-2">
            <input
              name="starter_text"
              value={starter}
              onChange={(event) =>
                update(
                  "starters",
                  draft.starters.map((entry, entryIndex) =>
                    entryIndex === index ? event.target.value : entry,
                  ),
                )
              }
              className="min-w-0 flex-1 rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
              placeholder="Walk into the storm with me."
            />
            <button
              type="button"
              onClick={() =>
                update(
                  "starters",
                  draft.starters.length === 1
                    ? [""]
                    : draft.starters.filter((_, currentIndex) => currentIndex !== index),
                )
              }
              className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-muted-foreground"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update("starters", [...draft.starters, ""])}
          className="rounded bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface"
        >
          Add starter
        </button>
      </div>

      {/* ── Tab 4: Examples ── */}
      <div className={cn(activeTab !== "examples" && "hidden", "space-y-3")}>
        <p className="text-xs text-muted-foreground">
          Short exchanges that teach rhythm and tone.
        </p>
        {draft.examples.map((example, index) => (
          <div key={`example-${index}`} className="rounded-lg border border-border-subtle bg-surface-container-low p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="User line"
                name="example_user_line"
                value={example.user}
                rows={3}
                onChange={(value) =>
                  update(
                    "examples",
                    draft.examples.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, user: value } : entry,
                    ),
                  )
                }
              />
              <TextField
                label="Character line"
                name="example_character_line"
                value={example.character}
                rows={3}
                onChange={(value) =>
                  update(
                    "examples",
                    draft.examples.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, character: value } : entry,
                    ),
                  )
                }
              />
            </div>
            <button
              type="button"
              onClick={() =>
                update(
                  "examples",
                  draft.examples.length === 1
                    ? [{ user: "", character: "" }]
                    : draft.examples.filter((_, currentIndex) => currentIndex !== index),
                )
              }
              className="mt-2 rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-muted-foreground"
            >
              Remove example
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update("examples", [...draft.examples, { user: "", character: "" }])
          }
          className="rounded bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface"
        >
          Add example pair
        </button>
      </div>

      <div className="sticky bottom-4 z-20 rounded-lg border border-border-subtle bg-surface-container-low/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface">
              {isDirty ? "Unsaved changes." : "In sync."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {editing ? "Local draft protection enabled." : "Draft persists on this device."}
            </p>
          </div>
          <SubmitButton className="shrink-0 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
            {editing ? "Save character" : "Create character"}
          </SubmitButton>
        </div>
      </div>
      <ConfirmationDialog request={confirmRequest} onClose={clearConfirm} />
    </form>
  );
}
