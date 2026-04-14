"use client";

import type {
  ComponentProps,
  CSSProperties,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import Image from "next/image";
import {
  Expand,
  GitBranchPlus,
  Minimize2,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import { PretextTranscript } from "@/components/chat/pretext-transcript";
import {
  ChatComposer,
  EmptyStateGuide,
  ModelPicker,
} from "@/components/chat/chat-composer-ui";
import { InspectorPanel } from "@/components/chat/chat-inspector-panel";
import type { ChatBranchRecord, UserPersonaRecord } from "@/lib/types";
import type { InspectorTab, ModelChoiceGroup } from "@/components/chat/chat-ui-types";

type TranscriptProps = ComponentProps<typeof PretextTranscript>;
type ComposerProps = ComponentProps<typeof ChatComposer>;

export function ChatFocusOverlay({
  focusMode,
  toggleFocusMode,
  focusBackdropColor,
  portraitState,
  onPortraitLoad,
  onPortraitError,
  characterBackgroundUrl,
  characterName,
  displayConnectionLabel,
  displayModel,
  transcriptProps,
  errorBannerBlock,
  composerProps,
}: {
  focusMode: boolean;
  toggleFocusMode: () => void;
  focusBackdropColor: string;
  portraitState: "idle" | "ready" | "error";
  onPortraitLoad: () => void;
  onPortraitError: () => void;
  characterBackgroundUrl?: string | null;
  characterName: string;
  displayConnectionLabel: string;
  displayModel: string;
  transcriptProps: TranscriptProps;
  errorBannerBlock: ReactNode;
  composerProps: ComposerProps;
}) {
  if (!focusMode) {
    return null;
  }

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-300 fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--focus-bg-base)]"
      data-testid="focus-mode-overlay"
      style={{ "--focus-bg-base": focusBackdropColor } as CSSProperties}
    >
      <div className="absolute inset-0 bg-[var(--focus-bg-base)]" />
      {characterBackgroundUrl && portraitState !== "error" ? (
        <Image
          src={characterBackgroundUrl}
          alt=""
          fill
          priority
          className="absolute inset-0 object-cover"
          onLoad={onPortraitLoad}
          onError={onPortraitError}
          unoptimized
        />
      ) : null}
      <div
        className="absolute inset-0 backdrop-blur-[10px]"
        style={{
          backgroundColor: "var(--focus-bg-base)",
          backgroundImage:
            "radial-gradient(circle at top, rgba(29,22,18,0.45), rgba(12,10,8,0.82) 48%, rgba(8,7,6,0.96) 100%)",
        }}
      />

      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFocusMode}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Exit focus
          </button>
          <h2 className="font-serif text-lg text-foreground">{characterName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-border bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft sm:inline-flex">
            {displayConnectionLabel}
          </span>
          <span className="rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            {displayModel}
          </span>
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden px-3 pt-3 md:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--focus-bg-base)] to-transparent" />
        <PretextTranscript {...transcriptProps} focusMode />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--focus-bg-base)] to-transparent" />
      </div>

      <div
        className="relative z-10 shrink-0 border-t border-white/6 px-3 pb-3 md:px-6"
        style={{ backgroundColor: "color-mix(in srgb, var(--focus-bg-base) 78%, transparent)" }}
      >
        {errorBannerBlock}
        <ChatComposer {...composerProps} focusMode />
      </div>
    </div>
  );
}

export function ChatScenePanel({
  focusMode,
  characterName,
  displayConnectionLabel,
  displayModel,
  showModelPicker,
  setShowModelPicker,
  toggleFocusMode,
  displayBranchId,
  branches,
  switchPending,
  onBranchSwitch,
  displayPersonaId,
  personas,
  onPersonaSwitch,
  currentModel,
  currentConnectionLabel,
  modelChoices,
  messagesLength,
  composerBusy,
  suggestedStarters,
  triggerStarter,
  transcriptProps,
  errorBannerBlock,
  composerProps,
  activeBranch,
  activeInspectorTab,
  inspectorView,
  pendingAction,
  removePin,
  setActiveInspectorTab,
  onModelSwitch,
}: {
  focusMode: boolean;
  characterName: string;
  displayConnectionLabel: string;
  displayModel: string;
  showModelPicker: boolean;
  setShowModelPicker: Dispatch<SetStateAction<boolean>>;
  toggleFocusMode: () => void;
  displayBranchId: string;
  branches: ChatBranchRecord[];
  switchPending: boolean;
  onBranchSwitch: (branchId: string) => Promise<void>;
  displayPersonaId: string;
  personas: UserPersonaRecord[];
  onPersonaSwitch: (personaId: string) => Promise<void>;
  currentModel: string;
  currentConnectionLabel: string;
  modelChoices: ModelChoiceGroup[];
  messagesLength: number;
  composerBusy: boolean;
  suggestedStarters: string[];
  triggerStarter: (starter: string, onSuccess?: () => void) => void;
  transcriptProps: TranscriptProps;
  errorBannerBlock: ReactNode;
  composerProps: ComposerProps;
  activeBranch: ChatBranchRecord;
  activeInspectorTab: InspectorTab;
  inspectorView: ComponentProps<typeof InspectorPanel>["inspectorView"];
  pendingAction: string | null;
  removePin: (pinId: string) => Promise<void>;
  setActiveInspectorTab: Dispatch<SetStateAction<InspectorTab>>;
  onModelSwitch: (
    connectionId: string,
    modelId: string,
    label: string,
  ) => Promise<void>;
}) {
  return (
    <div
      className={focusMode ? "invisible h-0 overflow-hidden" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"}
      data-testid="chat-workspace"
    >
      <section className="paper-panel rounded-[2rem] p-6">
        <div className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                Live scene
              </p>
              <h2 className="mt-2 font-serif text-3xl text-foreground">{characterName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                Transcript first. Adjust the lane, branch, or persona here when you want to
                steer the next beat without crowding the scene.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                {displayConnectionLabel}
              </span>
              <span className="rounded-full bg-brand/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                {displayModel}
              </span>
              <button
                type="button"
                onClick={() => setShowModelPicker((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                <RefreshCcw className="h-4 w-4" />
                Switch model
              </button>
              <button
                type="button"
                onClick={toggleFocusMode}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                data-testid="enter-focus-mode"
              >
                <Expand className="h-4 w-4" />
                Focus
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="rounded-[1.4rem] border border-border bg-white/5 p-4 text-sm text-foreground">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft">
                <GitBranchPlus className="h-4 w-4" />
                Active branch
              </div>
              <select
                value={displayBranchId}
                disabled={switchPending}
                onChange={(e) => void onBranchSwitch(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-border bg-paper px-3 py-3 text-sm font-semibold outline-none"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[1.4rem] border border-border bg-white/5 p-4 text-sm text-foreground">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft">
                <UserRound className="h-4 w-4" />
                Active persona
              </div>
              <select
                value={displayPersonaId}
                disabled={switchPending || personas.length === 0}
                onChange={(e) => void onPersonaSwitch(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-border bg-paper px-3 py-3 text-sm font-semibold outline-none"
              >
                {personas.length ? (
                  personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No personas available
                  </option>
                )}
              </select>
            </label>
          </div>
        </div>

        {showModelPicker ? (
          <ModelPicker
            currentModel={currentModel}
            modelChoices={modelChoices}
            switchPending={switchPending}
            onClose={() => setShowModelPicker(false)}
            onSelectModel={async (connectionId, modelId) => {
              const matchedGroup = modelChoices.find((g) => g.connectionId === connectionId);
              await onModelSwitch(
                connectionId,
                modelId,
                matchedGroup?.label ?? currentConnectionLabel,
              );
              setShowModelPicker(false);
            }}
          />
        ) : null}

        {!messagesLength ? (
          <EmptyStateGuide
            disabled={composerBusy}
            suggestedStarters={suggestedStarters}
            onSelectStarter={(starter) => triggerStarter(starter, () => composerProps.onDraftChange(""))}
          />
        ) : null}

        <div className="mt-5">
          <PretextTranscript {...transcriptProps} />
        </div>

        {errorBannerBlock}

        <ChatComposer {...composerProps} />
      </section>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <InspectorPanel
          activeBranch={activeBranch}
          activeInspectorTab={activeInspectorTab}
          branches={branches}
          inspectorView={inspectorView}
          pendingAction={pendingAction}
          onRemovePin={removePin}
          onTabChange={setActiveInspectorTab}
        />
      </aside>
    </div>
  );
}
