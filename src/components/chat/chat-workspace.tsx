"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useNavTransition } from "@/components/transition-provider";
import { Expand, GitBranchPlus, Minimize2, RefreshCcw, UserRound } from "lucide-react";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  FantasiaUIMessage,
  TranscriptControl,
  UserPersonaRecord,
} from "@/lib/types";
import { messageMetadataSchema } from "@/lib/types";
import { PretextTranscript } from "@/components/chat/pretext-transcript";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useChatActions } from "@/components/chat/use-chat-actions";
import { useOptimisticSwitches } from "@/components/chat/use-optimistic-switches";
import {
  ActionSheet,
  type ActionSheetState,
  ChatComposer,
  EmptyStateGuide,
  ErrorBanner,
  InspectorPanel,
  type InspectorTab,
  ModelPicker,
  type ModelChoiceGroup,
} from "@/components/chat/chat-workspace-parts";

export function ChatWorkspace({
  threadId,
  characterName,
  characterBackgroundUrl,
  currentModel,
  currentConnectionLabel,
  activeBranch,
  branches,
  currentPersona,
  personas,
  initialMessages,
  controlsByMessageId,
  suggestedStarters,
  modelChoices,
  inspectorView,
  switchModelAction,
  switchBranchAction,
  switchPersonaAction,
}: {
  threadId: string;
  characterName: string;
  characterBackgroundUrl?: string | null;
  currentModel: string;
  currentConnectionLabel: string;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  currentPersona: UserPersonaRecord | null;
  personas: UserPersonaRecord[];
  initialMessages: FantasiaUIMessage[];
  controlsByMessageId: Record<string, TranscriptControl>;
  suggestedStarters: string[];
  modelChoices: ModelChoiceGroup[];
  inspectorView: ContinuityInspectorView;
  switchModelAction: (input: { threadId: string; connectionId: string; modelId: string; }) => Promise<void>;
  switchBranchAction: (input: { threadId: string; branchId: string; }) => Promise<void>;
  switchPersonaAction: (input: { threadId: string; personaId: string; }) => Promise<void>;
}) {
  const { isNavigating, refreshWithTransition } = useNavTransition();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const attemptedDraftRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("continuity");
  const [sheet, setSheet] = useState<ActionSheetState | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [portraitState, setPortraitState] = useState<"idle" | "ready" | "error">(
    characterBackgroundUrl ? "idle" : "error",
  );
  const [lastUrl, setLastUrl] = useState(characterBackgroundUrl);

  // Sync portrait state during render to avoid cascading useEffect renders
  if (characterBackgroundUrl !== lastUrl) {
    setLastUrl(characterBackgroundUrl);
    setPortraitState(characterBackgroundUrl ? "idle" : "error");
  }

  const {
    pendingAction,
    surfaceError,
    setSurfaceError,
    regenerate,
    rewind,
    rate,
    editMessage,
    createBranch,
    createPin,
    removePin,
    triggerStarter
  } = useChatActions(threadId);

  const {
    switchPending,
    optimisticBranchId,
    optimisticPersonaId,
    optimisticModel,
    onBranchSwitch,
    onPersonaSwitch,
    onModelSwitch
  } = useOptimisticSwitches({
    threadId,
    setSurfaceError,
    switchModelAction,
    switchBranchAction,
    switchPersonaAction,
  });

  const displayModel = optimisticModel?.modelId ?? currentModel;
  const displayConnectionLabel = optimisticModel?.label ?? currentConnectionLabel;
  const displayBranchId = optimisticBranchId ?? activeBranch.id;
  const displayPersonaId = optimisticPersonaId ?? (currentPersona?.id ?? "");

  const toggleFocusMode = useCallback(() => setFocusMode((prev) => !prev), []);

  useEffect(() => {
    if (!focusMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFocusMode(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  useEffect(() => {
    if (focusMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [focusMode]);



  const { messages, sendMessage, status, error } = useChat<FantasiaUIMessage>({
    id: threadId,
    messages: initialMessages,
    messageMetadataSchema,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId },
    }),
    async onFinish() {
      attemptedDraftRef.current = null;
      setFailedDraft(null);
      setSurfaceError(null);
      refreshWithTransition();
    },
    onError(nextError) {
      const nextMessage = humanizeChatError(nextError.message);
      setSurfaceError(nextMessage);
      const failed = attemptedDraftRef.current;
      if (failed) {
        setFailedDraft(failed);
        setDraft((current) => (current.trim().length ? current : failed));
        requestAnimationFrame(() => composerRef.current?.focus());
      }
    },
  });

  const fallbackModels = useMemo(
    () =>
      modelChoices
        .flatMap((choice) =>
          choice.models.map((model) => ({
            connectionId: choice.connectionId,
            label: choice.label,
            provider: choice.provider,
            model,
          })),
        )
        .filter((option) => option.model.id !== currentModel)
        .slice(0, 5),
    [currentModel, modelChoices],
  );

  const activeError = surfaceError || (error ? humanizeChatError(error.message) : null);
  const continuityBlocked =
    inspectorView.continuityStatus?.tone === "pending" ||
    inspectorView.continuityStatus?.tone === "error";
  const composerBusy =
    status === "streaming" ||
    status === "submitted" ||
    pendingAction !== null ||
    switchPending ||
    isNavigating ||
    continuityBlocked;

  async function submitCurrentDraft(value: string) {
    const nextValue = value.trim();
    if (!nextValue) return;

    setSurfaceError(null);
    setFailedDraft(null);
    attemptedDraftRef.current = nextValue;
    setDraft("");

    try {
      await sendMessage({ text: nextValue });
    } catch (nextError) {
      attemptedDraftRef.current = null;
      const nextMessage =
        nextError instanceof Error
          ? humanizeChatError(nextError.message)
          : "We couldn't send that turn.";
      setSurfaceError(nextMessage);
      setFailedDraft(nextValue);
      setDraft(nextValue);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  function openBranchSheet(checkpointId: string) {
    setSheet({
      kind: "branch",
      checkpointId,
      value: `branch-${branches.length + 1}`,
    });
  }

  /* ── Transcript + callbacks (shared props, used in both views) ── */
  const transcriptProps = {
    messages,
    assistantLabel: characterName,
    controlsByMessageId,
    pendingAction,
    continuityBlocked,
    onRegenerate: regenerate,
    onOpenEditMessage: (messageId: string, currentText: string) =>
      setSheet({ kind: "edit", messageId, value: currentText }),
    onOpenBranchFromCheckpoint: openBranchSheet,
    onRewindCheckpoint: async (checkpointId: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Rewind to this turn? This keeps the selected checkpoint as the branch head and permanently deletes every descendant path below it.",
        )
      ) {
        return;
      }
      rewind(checkpointId, () => {
        requestAnimationFrame(() => composerRef.current?.focus());
      });
    },
    onOpenPinMessage: (messageId: string, currentText: string) =>
      setSheet({ kind: "pin", messageId, value: currentText }),
    onRateCheckpoint: rate,
  } as const;

  const composerProps = {
    composerBusy,
    composerRef,
    draft,
    status,
    onDraftChange: setDraft,
    onSubmit: () => submitCurrentDraft(draft),
  } as const;

  const errorBannerBlock = activeError ? (
    <ErrorBanner
      activeError={activeError}
      composerBusy={composerBusy}
      failedDraft={failedDraft}
      fallbackModels={fallbackModels}
      onEditDraft={(value) => {
        setDraft(value);
        requestAnimationFrame(() => composerRef.current?.focus());
      }}
      onRetry={(value) => void submitCurrentDraft(value)}
      onShowModelPicker={() => setShowModelPicker(true)}
    />
  ) : null;
  const focusBackdropColor = portraitState === "ready" ? "#120f0d" : "#0f0c0a";

  return (
    <>
      {/* ── Focus mode overlay ── */}
      {focusMode ? (
        <div
          className="animate-in fade-in zoom-in-95 duration-300 fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--focus-bg-base)]"
          data-testid="focus-mode-overlay"
          style={{ "--focus-bg-base": focusBackdropColor } as React.CSSProperties}
        >
          <div className="absolute inset-0 bg-[var(--focus-bg-base)]" />
          {characterBackgroundUrl && portraitState !== "error" ? (
            <>
              <Image
                src={characterBackgroundUrl}
                alt=""
                fill
                priority
                className="absolute inset-0 object-cover"
                onLoad={() => setPortraitState("ready")}
                onError={() => setPortraitState("error")}
                unoptimized
              />
            </>
          ) : null}
          <div
            className="absolute inset-0 backdrop-blur-[10px]"
            style={{
              backgroundColor: "var(--focus-bg-base)",
              backgroundImage:
                "radial-gradient(circle at top, rgba(29,22,18,0.45), rgba(12,10,8,0.82) 48%, rgba(8,7,6,0.96) 100%)",
            }}
          />

          {/* Top bar — fixed height */}
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

          {/* Transcript — fills remaining space, scrollable */}
          <div className="relative z-10 min-h-0 flex-1 overflow-hidden px-3 pt-3 md:px-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--focus-bg-base)] to-transparent" />
            <PretextTranscript {...transcriptProps} focusMode />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--focus-bg-base)] to-transparent" />
          </div>

          {/* Error banner + Composer — pinned at bottom, never overlaps */}
          <div
            className="relative z-10 shrink-0 border-t border-white/6 px-3 pb-3 md:px-6"
            style={{ backgroundColor: "color-mix(in srgb, var(--focus-bg-base) 78%, transparent)" }}
          >
            {errorBannerBlock}
            <ChatComposer {...composerProps} focusMode />
          </div>
        </div>
      ) : null}

      {/* ── Normal layout (hidden visually when focus is active, kept mounted) ── */}
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
                  onChange={(e) => onBranchSwitch(e.target.value)}
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
                  onChange={(e) => onPersonaSwitch(e.target.value)}
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
                await onModelSwitch(connectionId, modelId, matchedGroup?.label ?? currentConnectionLabel);
                setShowModelPicker(false);
              }}
            />
          ) : null}

          {!messages.length ? (
            <EmptyStateGuide
              disabled={composerBusy}
              suggestedStarters={suggestedStarters}
              onSelectStarter={(starter) => triggerStarter(starter, () => setDraft(""))}
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

      {sheet ? (
        <ActionSheet
          key={
            sheet.kind === "branch"
                ? `branch-${sheet.checkpointId}`
                : sheet.kind === "edit"
                  ? `edit-${sheet.messageId}`
                  : `pin-${sheet.messageId}`
          }
          sheet={sheet}
          pendingAction={pendingAction}
          onClose={() => setSheet(null)}
          onSubmit={async (value) => {
            if (sheet.kind === "edit") {
              await editMessage(sheet.messageId, value);
            } else if (sheet.kind === "branch") {
              await createBranch({ checkpointId: sheet.checkpointId, name: value });
            } else {
              await createPin(sheet.messageId, value);
            }
            setSheet(null);
          }}
        />
      ) : null}
    </>
  );
}
