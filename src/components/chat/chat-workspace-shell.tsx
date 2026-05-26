"use client";

import type {
  ComponentProps,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  MoreVertical,
  GitBranchPlus,
  UserRound,
  RefreshCcw,
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
import { useState } from "react";

type TranscriptProps = ComponentProps<typeof PretextTranscript>;
type ComposerProps = ComponentProps<typeof ChatComposer>;

export function ChatLayout({
  characterName,
  characterBackgroundUrl,
  portraitState,
  onPortraitLoad,
  onPortraitError,
  displayConnectionLabel,
  displayModel,
  showModelPicker,
  setShowModelPicker,
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
  continuityBannerBlock,
  errorBannerBlock,
  composerProps,
  activeBranch,
  activeInspectorTab,
  inspectorView,
  pendingAction,
  removePin,
  setActiveInspectorTab,
  onModelSwitch,
  currentBrainConnectionId,
  currentBrainModelId,
  optimisticBrainModel,
  onBrainModelSwitch,
}: {
  characterName: string;
  characterBackgroundUrl?: string | null;
  portraitState: "idle" | "ready" | "error";
  onPortraitLoad: () => void;
  onPortraitError: () => void;
  displayConnectionLabel: string;
  displayModel: string;
  showModelPicker: boolean;
  setShowModelPicker: Dispatch<SetStateAction<boolean>>;
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
  continuityBannerBlock: ReactNode;
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
  currentBrainConnectionId?: string | null;
  currentBrainModelId?: string | null;
  optimisticBrainModel: { connectionId: string | null; modelId: string | null } | null;
  onBrainModelSwitch: (
    connectionId: string | null,
    modelId: string | null,
  ) => Promise<void>;
}) {
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  const displayBrainConnectionId = optimisticBrainModel !== null
    ? optimisticBrainModel.connectionId
    : (currentBrainConnectionId ?? null);
  
  const displayBrainModelId = optimisticBrainModel !== null
    ? optimisticBrainModel.modelId
    : (currentBrainModelId ?? null);

  const displayBrainSelectVal = (displayBrainConnectionId && displayBrainModelId)
    ? `${displayBrainConnectionId}:${displayBrainModelId}`
    : "";

  const brainModelChoices = modelChoices.filter((group) => group.provider !== "deepseek");

  const handleBrainModelSwitch = async (val: string) => {
    if (!val) {
      await onBrainModelSwitch(null, null);
    } else {
      const parts = val.split(":");
      const connId = parts[0];
      const modelId = parts.slice(1).join(":");
      await onBrainModelSwitch(connId, modelId);
    }
  };

  return (
    <div
      className="relative flex h-dvh flex-col bg-background-base"
      data-testid="chat-workspace"
    >
      {/* Character portrait background */}
      {characterBackgroundUrl && portraitState !== "error" && (
        <>
          <Image
            src={characterBackgroundUrl}
            alt=""
            fill
            priority
            className="pointer-events-none fixed inset-0 object-cover opacity-[0.06] grayscale"
            onLoad={onPortraitLoad}
            onError={onPortraitError}
            unoptimized
          />
          <div className="pointer-events-none fixed inset-0 bg-background-base/90" />
        </>
      )}

      {/* Header */}
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface/80 px-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="truncate font-display text-sm font-semibold text-on-surface">
            {characterName}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden rounded border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground sm:inline">
            {displayModel}
          </span>
          <button
            type="button"
            onClick={() => setRightDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant"
            aria-label="Open settings panel"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Transcript area */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden px-3 pt-2 sm:px-4">
        {!messagesLength ? (
          <EmptyStateGuide
            disabled={composerBusy}
            suggestedStarters={suggestedStarters}
            onSelectStarter={(starter) =>
              triggerStarter(starter, () => composerProps.onDraftChange(""))
            }
          />
        ) : null}
        <PretextTranscript {...transcriptProps} />
      </div>

      {/* Input area */}
      <div className="relative z-10 shrink-0 border-t border-border-subtle bg-surface/80 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:px-4">
        {continuityBannerBlock}
        {errorBannerBlock}
        <ChatComposer {...composerProps} />
      </div>

      {/* Model picker overlay */}
      {showModelPicker && (
        <ModelPicker
          currentModel={currentModel}
          modelChoices={modelChoices}
          switchPending={switchPending}
          onClose={() => setShowModelPicker(false)}
          onSelectModel={async (connectionId, modelId) => {
            const matchedGroup = modelChoices.find(
              (g) => g.connectionId === connectionId,
            );
            await onModelSwitch(
              connectionId,
              modelId,
              matchedGroup?.label ?? currentConnectionLabel,
            );
            setShowModelPicker(false);
          }}
        />
      )}

      {/* Right drawer for settings/inspector */}
      {rightDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setRightDrawerOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Close panel"
          />
          <div className="absolute inset-y-0 right-0 flex w-80 flex-col border-l border-border-subtle bg-surface-container-low overflow-y-auto">
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-on-surface">
                  Thread Settings
                </h2>
                <button
                  type="button"
                  onClick={() => setRightDrawerOpen(false)}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Connection info */}
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Lane
              </p>
              <p className="mt-1 text-sm font-medium text-on-surface">
                {displayConnectionLabel}
              </p>
              <p className="text-xs text-muted-foreground">{displayModel}</p>
              <button
                type="button"
                onClick={() => {
                  setShowModelPicker(true);
                  setRightDrawerOpen(false);
                }}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-container"
              >
                <RefreshCcw className="h-3 w-3" />
                Switch model
              </button>
            </div>

            {/* Brain (HCE) model picker */}
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                HCE Brain Model
              </p>
              <select
                value={displayBrainSelectVal}
                disabled={switchPending}
                onChange={(e) => void handleBrainModelSwitch(e.target.value)}
                className="mt-2 w-full rounded border border-border-subtle bg-surface-container px-2 py-1.5 text-sm text-on-surface outline-none"
              >
                <option value="">Default (Inherit Chat Model)</option>
                {brainModelChoices.map((choice) => (
                  <optgroup key={choice.connectionId} label={choice.label}>
                    {choice.models.map((model) => (
                      <option key={`${choice.connectionId}:${model.id}`} value={`${choice.connectionId}:${model.id}`}>
                        {model.name || model.id}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                Handles world-state JSON extraction. Pick a JSON-reliable model (e.g. Gemini, Mistral) if using DeepSeek for creative writing chat.
              </p>
            </div>

            {/* Branch picker */}
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <GitBranchPlus className="mr-1 inline h-3 w-3" />
                Branch
              </p>
              <select
                value={displayBranchId}
                disabled={switchPending}
                onChange={(e) => void onBranchSwitch(e.target.value)}
                className="mt-2 w-full rounded border border-border-subtle bg-surface-container px-2 py-1.5 text-sm text-on-surface outline-none"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Persona picker */}
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <UserRound className="mr-1 inline h-3 w-3" />
                Persona
              </p>
              <select
                value={displayPersonaId}
                disabled={switchPending || personas.length === 0}
                onChange={(e) => void onPersonaSwitch(e.target.value)}
                className="mt-2 w-full rounded border border-border-subtle bg-surface-container px-2 py-1.5 text-sm text-on-surface outline-none"
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
            </div>

            {/* Inspector panel */}
            <div className="flex-1 px-4 py-3">
              <InspectorPanel
                activeBranch={activeBranch}
                activeInspectorTab={activeInspectorTab}
                branches={branches}
                inspectorView={inspectorView}
                pendingAction={pendingAction}
                onRemovePin={removePin}
                onTabChange={setActiveInspectorTab}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
