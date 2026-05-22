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
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[6.5rem] w-full rounded-3xl border border-border bg-white/5 px-4 py-3 text-sm leading-7 outline-none transition focus:border-brand"
      />
      {helper ? <span className="mt-2 block text-xs leading-6 text-ink-soft">{helper}</span> : null}
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

  useUnsavedChangesGuard(
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
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="id" value={editing?.character.id ?? ""} />

      {hasStoredDraft ? (
        <div className="rounded-[1.6rem] border border-accent/25 bg-accent/10 px-5 py-4 text-sm text-accent">
          <p className="font-semibold">Local draft found on this device.</p>
          <p className="mt-2 leading-7">
            You left unsaved character work here earlier. Restore it or discard it before you keep editing.
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
        <div aria-live="polite" className="rounded-[1.6rem] bg-emerald-950/40 px-5 py-4 text-sm text-emerald-400">
          Your locally restored draft is back in the editor. Save when you are ready.
        </div>
      ) : null}

      <JsonPortabilityPanel
        key={`character-portability-${editing?.character.id ?? "new"}`}
        kind="character"
        currentData={characterDraftToPortableData(draft)}
        onImport={importCharacterData}
      />

      <div className="rounded-[1.8rem] border border-border bg-white/5 p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeTab === tab.id
                  ? "bg-brand text-white"
                  : "text-ink-soft hover:bg-paper hover:text-foreground",
              )}
            >
              {tab.label}
              {sectionProgress[tab.id] ? (
                <span className="ml-2 text-[10px] uppercase tracking-[0.16em] opacity-75">
                  ready
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 rounded-[1.4rem] bg-paper px-4 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft">
          <span>{completedSections}/4 sections carrying real signal</span>
          <span>{isDirty ? "unsaved changes" : "all changes saved to server"}</span>
        </div>
      </div>

      {/* ── Tab 1: Story ── */}
      <div className={cn(activeTab !== "story" && "hidden", "space-y-5")}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-foreground">Name</span>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            className="w-full rounded-full border border-border bg-white/5 px-4 py-3 outline-none transition focus:border-brand"
            placeholder="Captain Mirelle"
          />
          <span className="mt-2 block text-xs leading-6 text-ink-soft">
            The name the model will use in every response. Make it distinct.
          </span>
        </label>

        <TextField
          label="Story"
          name="story"
          value={draft.story}
          rows={8}
          helper="The complete story setup: the world, the setting, what's happening right now, and the character's relationship to the user. This is the most important field — it tells the AI what kind of scene to play."
          onChange={(value) => update("story", value)}
        />

        <TextField
          label="Personality"
          name="core_persona"
          value={draft.core_persona}
          rows={5}
          helper="Who they are underneath — values, contradictions, fears, humor, warmth. The emotional texture the model should sustain."
          onChange={(value) => update("core_persona", value)}
        />

        <TextField
          label="Greeting"
          name="greeting"
          value={draft.greeting}
          rows={4}
          helper="The opening line that sets the scene. This is the very first impression."
          onChange={(value) => update("greeting", value)}
        />

        <TextField
          label="Appearance"
          name="appearance"
          value={draft.appearance}
          rows={4}
          helper="Describe the character's look for portrait generation: face, hair, build, clothing, accessories. Not sent to the AI."
          onChange={(value) => update("appearance", value)}
        />

        <section className="rounded-[1.6rem] border border-border bg-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Portrait</p>
              <h3 className="mt-2 font-serif text-2xl text-foreground">{portraitStatusLabel}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
                {!draftAppearance
                  ? "Add an appearance description and save the character to queue a portrait for focus mode."
                  : !editing
                    ? "Save this character first to queue portrait generation."
                    : portraitStatus === "pending"
                      ? "A portrait is being generated. Refresh the page to check progress."
                      : portraitStatus === "ready"
                        ? "Your character portrait is ready and will appear in focus mode."
                        : portraitStatus === "failed"
                          ? "Portrait generation failed. You can try regenerating below."
                          : "Save any changes to appearance or personality to generate a new portrait."}
              </p>
              {hasUnsavedPortraitInputs ? (
                <p className="mt-2 text-xs leading-6 text-amber-300">
                  Unsaved name, appearance, or personality changes will not affect the portrait until you save.
                </p>
              ) : null}
            </div>

            {editing && regeneratePortraitAction ? (
              <button
                type="submit"
                formAction={regeneratePortraitAction}
                disabled={!savedAppearance}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-white/8 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                Regenerate portrait
              </button>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border bg-[#14100e]">
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
              <div className="flex aspect-square items-center justify-center px-8 text-center text-sm leading-7 text-ink-soft">
                {!draftAppearance
                  ? "No appearance prompt yet."
                  : portraitStatus === "pending"
                    ? "Generating a portrait for focus mode..."
                    : portraitStatus === "failed"
                      ? "Last generation attempt failed."
                      : "Portrait will generate after save."}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Tab 2: Voice ── */}
      <div className={cn(activeTab !== "voice" && "hidden", "space-y-5")}>
        <TextField
          label="Writing style"
          name="style_rules"
          value={draft.style_rules}
          rows={5}
          helper="Prose cadence, formatting habits, humor, restraint, or any repeated voice rule the model should follow."
          onChange={(value) => update("style_rules", value)}
        />
        <TextField
          label="Behavior rules"
          name="definition"
          value={draft.definition}
          rows={8}
          helper="Hard behavioral constraints that should survive long chats: priorities, habits, reactions that never change."
          onChange={(value) => update("definition", value)}
        />
        <TextField
          label="Boundaries"
          name="negative_guidance"
          value={draft.negative_guidance}
          rows={5}
          helper="What the character must never do, say, or collapse into. Hard limits the model should respect."
          onChange={(value) => update("negative_guidance", value)}
        />
      </div>

      {/* ── Tab 3: Starters ── */}
      <div className={cn(activeTab !== "starters" && "hidden", "space-y-4")}>
        <p className="text-sm leading-7 text-ink-soft">
          One-tap starters should feel like scene-openers, not generic greetings. Give the user a specific emotional or narrative move to make.
        </p>
        {draft.starters.map((starter, index) => (
          <div key={`starter-${index}`} className="flex gap-3">
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
              className="flex-1 rounded-full border border-border bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand"
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
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update("starters", [...draft.starters, ""])}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
        >
          Add starter
        </button>
      </div>

      {/* ── Tab 4: Examples ── */}
      <div className={cn(activeTab !== "examples" && "hidden", "space-y-4")}>
        <p className="text-sm leading-7 text-ink-soft">
          Example dialogue teaches cadence better than summary text. Use short, high-signal exchanges that reveal rhythm, warmth, and tension.
        </p>
        {draft.examples.map((example, index) => (
          <div key={`example-${index}`} className="rounded-[1.5rem] border border-border bg-white/5 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="User line"
                name="example_user_line"
                value={example.user}
                rows={4}
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
                rows={4}
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
              className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
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
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
        >
          Add example pair
        </button>
      </div>

      <div className="sticky bottom-24 z-20 rounded-[1.8rem] border border-white/10 bg-[#1a1412]/96 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isDirty ? "Draft changes are only local until you save." : "Server copy is in sync with this editor."}
            </p>
            <p className="mt-1 text-xs leading-6 text-ink-soft">
              {editing
                ? "This editor protects against accidental tab closes and restores local work after interruptions."
                : "You can leave and come back later on this device without losing the current draft."}
            </p>
          </div>
          <SubmitButton className="shrink-0 px-6 py-3">
            {editing ? "Save character" : "Create character"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
