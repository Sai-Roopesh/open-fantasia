"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { humanizeChatError, throwIfFailed } from "@/components/chat/chat-workspace-helpers";
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
  switchModelAction: (input: {
    threadId: string;
    connectionId: string;
    modelId: string;
  }) => Promise<void>;
  switchBranchAction: (input: {
    threadId: string;
    branchId: string;
  }) => Promise<void>;
  switchPersonaAction: (input: {
    threadId: string;
    personaId: string;
  }) => Promise<void>;
}) {
  const { isNavigating, refreshWithTransition } = useNavTransition();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const attemptedDraftRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("continuity");
  const [sheet, setSheet] = useState<ActionSheetState | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  // Optimistic state — shows the user's selection immediately while the server round-trip runs
  const [optimisticBranchId, setOptimisticBranchId] = useState<string | null>(null);
  const [optimisticPersonaId, setOptimisticPersonaId] = useState<string | null>(null);
  const [optimisticModel, setOptimisticModel] = useState<{ modelId: string; label: string } | null>(null);

  // Reset optimistic state when server props arrive (switchPending goes false)
  useEffect(() => {
    if (!switchPending) {
      setOptimisticBranchId(null);
      setOptimisticPersonaId(null);
      setOptimisticModel(null);
    }
  }, [switchPending]);

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
  const composerBusy =
    status === "streaming" || status === "submitted" || pendingAction !== null || switchPending || isNavigating;

  async function runAction(label: string, callback: () => Promise<void>) {
    setPendingAction(label);
    setSurfaceError(null);
    try {
      await callback();
      setSheet(null);
      refreshWithTransition();
    } catch (nextError) {
      setSurfaceError(
        nextError instanceof Error ? humanizeChatError(nextError.message) : "That action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

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

  function openAlternates(control: TranscriptControl) {
    setSheet({ kind: "alternates", control });
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
    onRegenerate: (checkpointId: string) =>
      runAction("regenerate", async () => {
        const response = await fetch(`/api/chats/${threadId}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkpointId }),
        });
        await throwIfFailed(response, "Regenerate failed.");
      }),
    onOpenAlternates: openAlternates,
    onOpenEditMessage: (messageId: string, currentText: string) =>
      setSheet({ kind: "edit", messageId, value: currentText }),
    onOpenBranchFromCheckpoint: openBranchSheet,
    onRewindCheckpoint: async (checkpointId: string, currentText: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Rewind this branch to before this user turn? Everything after it on the current branch will disappear from the active path.",
        )
      ) {
        return;
      }
      await runAction("rewind", async () => {
        const response = await fetch(
          `/api/chats/${threadId}/checkpoints/${checkpointId}/rewind`,
          { method: "POST" },
        );
        await throwIfFailed(response, "Rewind failed.");
        setDraft(currentText);
        requestAnimationFrame(() => composerRef.current?.focus());
      });
    },
    onOpenPinMessage: (messageId: string, currentText: string) =>
      setSheet({ kind: "pin", messageId, value: currentText }),
    onRateCheckpoint: (checkpointId: string, rating: number) =>
      runAction("rate", async () => {
        const response = await fetch(
          `/api/chats/${threadId}/checkpoints/${checkpointId}/rate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating }),
          },
        );
        await throwIfFailed(response, "Rating failed.");
      }),
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

  return (
    <>
      {/* ── Focus mode overlay ── */}
      {focusMode ? (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0f0c0a]"
          data-testid="focus-mode-overlay"
        >
          {characterBackgroundUrl ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${characterBackgroundUrl})` }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(28,22,18,0.18),rgba(10,8,7,0.72)_48%,rgba(7,6,5,0.92)_100%)] backdrop-blur-[10px]" />
            </>
          ) : null}

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
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#0f0c0a] to-transparent" />
            <PretextTranscript {...transcriptProps} focusMode />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[#0f0c0a] to-transparent" />
          </div>

          {/* Error banner + Composer — pinned at bottom, never overlaps */}
          <div className="relative z-10 shrink-0 border-t border-white/6 bg-[#0f0c0a]/72 px-3 pb-3 md:px-6">
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
                  onChange={async (event) => {
                    const nextBranchId = event.target.value;
                    setOptimisticBranchId(nextBranchId);
                    setSwitchPending(true);
                    try {
                      await switchBranchAction({
                        threadId,
                        branchId: nextBranchId,
                      });
                      refreshWithTransition();
                    } finally {
                      setSwitchPending(false);
                    }
                  }}
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
                  disabled={switchPending}
                  onChange={async (event) => {
                    const nextPersonaId = event.target.value;
                    setOptimisticPersonaId(nextPersonaId);
                    setSwitchPending(true);
                    try {
                      await switchPersonaAction({
                        threadId,
                        personaId: nextPersonaId,
                      });
                      refreshWithTransition();
                    } finally {
                      setSwitchPending(false);
                    }
                  }}
                  className="mt-3 w-full rounded-2xl border border-border bg-paper px-3 py-3 text-sm font-semibold outline-none"
                >
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
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
                setOptimisticModel({ modelId, label: matchedGroup?.label ?? currentConnectionLabel });
                setSwitchPending(true);
                try {
                  await switchModelAction({
                    threadId,
                    connectionId,
                    modelId,
                  });
                  refreshWithTransition();
                  setShowModelPicker(false);
                } finally {
                  setSwitchPending(false);
                }
              }}
            />
          ) : null}

          {!messages.length ? (
            <EmptyStateGuide
              disabled={composerBusy}
              suggestedStarters={suggestedStarters}
              onSelectStarter={(starter) =>
                void runAction("starter", async () => {
                  const response = await fetch(`/api/chats/${threadId}/starter`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ starter }),
                  });
                  await throwIfFailed(response, "Starter generation failed.");
                  setDraft("");
                })
              }
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
            onRemovePin={(pinId) =>
              runAction("unpin", async () => {
                const response = await fetch(`/api/chats/${threadId}/pins/${pinId}`, {
                  method: "DELETE",
                });
                await throwIfFailed(response, "Failed to remove pin.");
              })
            }
            onTabChange={setActiveInspectorTab}
          />
        </aside>
      </div>

      {sheet ? (
        <ActionSheet
          key={
            sheet.kind === "alternates"
              ? `alternates-${sheet.control.checkpointId}`
              : sheet.kind === "branch"
                ? `branch-${sheet.checkpointId}`
                : sheet.kind === "edit"
                  ? `edit-${sheet.messageId}`
                  : `pin-${sheet.messageId}`
          }
          sheet={sheet}
          pendingAction={pendingAction}
          onClose={() => setSheet(null)}
          onSubmit={async (value, alternateCheckpointId) => {
            if (sheet.kind === "alternates") {
              if (!alternateCheckpointId) return;
              await runAction("alternate", async () => {
                const response = await fetch(
                  `/api/chats/${threadId}/checkpoints/${alternateCheckpointId}/select`,
                  {
                    method: "POST",
                  },
                );
                await throwIfFailed(response, "Alternate selection failed.");
              });
              return;
            }

            if (sheet.kind === "edit") {
              await runAction("edit", async () => {
                const response = await fetch(
                  `/api/chats/${threadId}/messages/${sheet.messageId}/edit`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: value }),
                  },
                );
                await throwIfFailed(response, "Edit failed.");
              });
              return;
            }

            if (sheet.kind === "branch") {
              await runAction("branch", async () => {
                const response = await fetch(`/api/chats/${threadId}/branches`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    checkpointId: sheet.checkpointId,
                    name: value,
                    makeActive: true,
                  }),
                });
                await throwIfFailed(response, "Branch creation failed.");
              });
              return;
            }

            await runAction("pin", async () => {
              const response = await fetch(`/api/chats/${threadId}/pins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sourceMessageId: sheet.messageId,
                  body: value,
                }),
              });
              await throwIfFailed(response, "Pin failed.");
            });
          }}
        />
      ) : null}
    </>
  );
}
