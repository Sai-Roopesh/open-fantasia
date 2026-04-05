"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { startTransition, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranchPlus,
  MessageCircleMore,
  RefreshCcw,
  Send,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  FantasiaUIMessage,
  ModelCatalogEntry,
  UserPersonaRecord,
} from "@/lib/types";
import { messageMetadataSchema } from "@/lib/types";
import { PretextTranscript, type TranscriptControl } from "@/components/chat/pretext-transcript";
import { cn } from "@/lib/utils";

type ModelChoiceGroup = {
  connectionId: string;
  label: string;
  provider: string;
  models: ModelCatalogEntry[];
};

type InspectorTab = "continuity" | "pins" | "timeline" | "branch";

type ActionSheetState =
  | {
      kind: "edit";
      messageId: string;
      value: string;
    }
  | {
      kind: "branch";
      checkpointId: string;
      value: string;
    }
  | {
      kind: "pin";
      messageId: string;
      value: string;
    }
  | {
      kind: "alternates";
      control: TranscriptControl;
    };

const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "continuity", label: "Continuity" },
  { id: "pins", label: "Pins" },
  { id: "timeline", label: "Timeline" },
  { id: "branch", label: "Branch" },
];

const starterScaffolds = [
  {
    title: "Open with emotional tension",
    text: "Pick up the scene with something unresolved between us. Keep the intimacy high and the conflict quiet.",
  },
  {
    title: "Drop into a new setting",
    text: "Move us into a fresh location and let the environment change the tone before anyone speaks.",
  },
  {
    title: "Ask for a confession",
    text: "Start with a question she has been avoiding, and make the answer cost her something.",
  },
];

export function ChatWorkspace({
  threadId,
  characterName,
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
  const router = useRouter();
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
      startTransition(() => router.refresh());
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
    status === "streaming" || status === "submitted" || pendingAction !== null || switchPending;

  async function runAction(label: string, callback: () => Promise<void>) {
    setPendingAction(label);
    setSurfaceError(null);
    try {
      await callback();
      setSheet(null);
      startTransition(() => router.refresh());
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

  function renderEmptyState() {
    const starters = suggestedStarters.length ? suggestedStarters : starterScaffolds.map((item) => item.text);

    return (
      <div className="mt-5 rounded-[1.75rem] border border-border bg-white/72 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-ink-soft">
          <WandSparkles className="h-4 w-4 text-brand" />
          First turn guidance
        </div>
        <h3 className="mt-3 font-serif text-3xl text-foreground">
          {suggestedStarters.length
            ? "Start from one of the character's seeded openings."
            : "This character has no starters yet, so scaffold the scene yourself."}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
          Pick a card to seed the composer, then shape the tone from there. The active
          persona changes how you speak, the active model changes how the reply is
          generated, and the active branch changes which continuity snapshot the next turn uses.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {starters.map((starter, index) => {
            const title =
              suggestedStarters[index] ? `Starter ${index + 1}` : starterScaffolds[index]?.title ?? `Prompt ${index + 1}`;
            return (
              <button
                key={`${title}-${starter}`}
                type="button"
                onClick={() => {
                  setDraft(starter);
                  requestAnimationFrame(() => composerRef.current?.focus());
                }}
                className="rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-left transition hover:border-brand hover:bg-white"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{title}</p>
                <p className="mt-3 text-sm leading-7 text-foreground">{starter}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="paper-panel rounded-[2rem] p-6">
          <div className="border-b border-border pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                  Active thread context
                </p>
                <h2 className="mt-3 font-serif text-4xl text-foreground">{characterName}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">
                  Keep the scene legible: model changes swap the generation lane, persona
                  changes adjust your voice, and branch changes swap which continuity snapshot
                  guides the next reply.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModelPicker((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                <RefreshCcw className="h-4 w-4" />
                Switch model
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ContextCard
                eyebrow="Character"
                title={characterName}
                helper="This is the persona and authored definition driving the assistant side of the scene."
              />

              <ContextCard
                eyebrow="Model lane"
                title={currentConnectionLabel}
                helper="Manual only. Switching here changes the provider/model for future turns without silently rerouting."
                footer={
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                    {currentModel}
                  </span>
                }
              />

              <label className="rounded-[1.6rem] border border-border bg-white/75 p-4 text-sm text-foreground">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft">
                  <GitBranchPlus className="h-4 w-4" />
                  Active branch
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Branch changes swap the canonical path and continuity snapshot used for the next turn.
                </p>
                <select
                  value={activeBranch.id}
                  disabled={switchPending}
                  onChange={async (event) => {
                    setSwitchPending(true);
                    try {
                      await switchBranchAction({
                        threadId,
                        branchId: event.target.value,
                      });
                      startTransition(() => router.refresh());
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

              <label className="rounded-[1.6rem] border border-border bg-white/75 p-4 text-sm text-foreground">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft">
                  <UserRound className="h-4 w-4" />
                  Active persona
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Persona changes shift the user&apos;s tone, goals, and boundaries in future turns.
                </p>
                <select
                  value={currentPersona?.id ?? ""}
                  disabled={switchPending}
                  onChange={async (event) => {
                    setSwitchPending(true);
                    try {
                      await switchPersonaAction({
                        threadId,
                        personaId: event.target.value,
                      });
                      startTransition(() => router.refresh());
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
            <div className="mt-5 rounded-[1.6rem] border border-border bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                    Model switcher
                  </p>
                  <p className="mt-2 text-sm leading-7 text-ink-soft">
                    Choose the exact lane you want next. Nothing changes automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModelPicker(false)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {modelChoices.length ? (
                  modelChoices.map((group) => (
                    <div key={group.connectionId} className="rounded-[1.4rem] border border-border bg-paper px-4 py-4">
                      <p className="text-sm font-semibold text-foreground">{group.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-soft">
                        {group.provider}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.models.map((model) => (
                          <button
                            key={`${group.connectionId}-${model.id}`}
                            type="button"
                            disabled={switchPending}
                            onClick={async () => {
                              setSwitchPending(true);
                              try {
                                await switchModelAction({
                                  threadId,
                                  connectionId: group.connectionId,
                                  modelId: model.id,
                                });
                                startTransition(() => router.refresh());
                                setShowModelPicker(false);
                              } finally {
                                setSwitchPending(false);
                              }
                            }}
                            className={cn(
                              "rounded-full border px-3 py-2 text-xs transition",
                              model.id === currentModel
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-white text-foreground hover:border-brand hover:text-brand",
                            )}
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.4rem] border border-dashed border-border px-4 py-4 text-sm leading-7 text-ink-soft">
                    No refreshed model lanes are available yet. Test a provider connection and refresh its models first.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {!messages.length ? renderEmptyState() : null}

          <div className="mt-5">
            <PretextTranscript
              messages={messages}
              assistantLabel={characterName}
              controlsByMessageId={controlsByMessageId}
              pendingAction={pendingAction}
              onRegenerate={(checkpointId) =>
                runAction("regenerate", async () => {
                  const response = await fetch(`/api/chats/${threadId}/regenerate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ checkpointId }),
                  });
                  await throwIfFailed(response, "Regenerate failed.");
                })
              }
              onOpenAlternates={openAlternates}
              onOpenEditMessage={(messageId, currentText) =>
                setSheet({
                  kind: "edit",
                  messageId,
                  value: currentText,
                })
              }
              onOpenBranchFromCheckpoint={openBranchSheet}
              onOpenPinMessage={(messageId, currentText) =>
                setSheet({
                  kind: "pin",
                  messageId,
                  value: currentText,
                })
              }
              onRateCheckpoint={(checkpointId, rating) =>
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
                })
              }
            />
          </div>

          {activeError ? (
            <div
              aria-live="polite"
              className="mt-4 rounded-[1.6rem] border border-brand/18 bg-brand/8 p-4 text-sm text-brand-strong"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Response interrupted
              </div>
              <p className="mt-2 leading-7">{activeError}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand">
                Your draft is preserved until a send completes successfully.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {failedDraft ? (
                  <>
                    <button
                      type="button"
                      disabled={composerBusy}
                      onClick={() => void submitCurrentDraft(failedDraft)}
                      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
                    >
                      Retry send
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(failedDraft);
                        requestAnimationFrame(() => composerRef.current?.focus());
                      }}
                      className="rounded-full border border-brand/25 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                    >
                      Edit draft
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowModelPicker(true)}
                  className="rounded-full border border-brand/25 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                >
                  Switch model
                </button>
              </div>

              {fallbackModels.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {fallbackModels.map((option) => (
                    <span
                      key={`${option.connectionId}-${option.model.id}`}
                      className="rounded-full border border-brand/18 bg-white px-3 py-1 text-xs"
                    >
                      {option.label}: {option.model.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <form
            className="mt-5 flex flex-col gap-3 md:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              await submitCurrentDraft(draft);
            }}
          >
            <label className="flex-1">
              <span className="sr-only">Prompt</span>
              <textarea
                ref={composerRef}
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Enter the next beat, confession, interruption, or scene turn..."
                className="w-full rounded-[1.75rem] border border-border bg-white px-5 py-4 text-sm leading-7 outline-none transition focus:border-brand"
              />
            </label>
            <button
              type="submit"
              disabled={composerBusy}
              className="inline-flex h-fit items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {status === "streaming" || status === "submitted" ? "Sending..." : "Send"}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="paper-panel rounded-[2rem] p-6">
            <div className="flex items-center gap-2 text-brand">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                Continuity inspector
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {inspectorTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInspectorTab(tab.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    activeInspectorTab === tab.id
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-foreground hover:border-brand hover:text-brand",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {activeInspectorTab === "continuity" ? (
                <div className="space-y-4">
                  {inspectorView.continuity.map((section) => (
                    <div
                      key={section.label}
                      className="rounded-[1.5rem] border border-border bg-white/75 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                        {section.label}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                        {section.value}
                      </p>
                      <p className="mt-3 text-xs leading-6 text-ink-soft">{section.helper}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeInspectorTab === "pins" ? (
                <div className="space-y-4">
                  {inspectorView.pins.length ? (
                    inspectorView.pins.map((pin) => (
                      <div
                        key={pin.id}
                        className="rounded-[1.5rem] border border-border bg-white/75 p-4"
                      >
                        <p className="text-sm leading-7 text-foreground">{pin.body}</p>
                        <div className="mt-3 text-xs leading-6 text-ink-soft">
                          <p>{pin.sourceLabel}</p>
                          <p className="mt-1">{pin.sourceExcerpt}</p>
                          <p className="mt-1">{formatLongTimestamp(pin.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() =>
                            runAction("unpin", async () => {
                              const response = await fetch(`/api/chats/${threadId}/pins/${pin.id}`, {
                                method: "DELETE",
                              });
                              await throwIfFailed(response, "Failed to remove pin.");
                            })
                          }
                          className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
                        >
                          Remove pin
                        </button>
                      </div>
                    ))
                  ) : (
                    <EmptyInspectorState>
                      Pin branch-local facts from transcript messages when continuity needs a durable reminder.
                    </EmptyInspectorState>
                  )}
                </div>
              ) : null}

              {activeInspectorTab === "timeline" ? (
                <div className="space-y-4">
                  {inspectorView.timeline.length ? (
                    inspectorView.timeline.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-[1.5rem] border border-border bg-white/75 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground">{event.title}</p>
                          <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                            importance {event.importance}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-foreground">{event.detail}</p>
                        <p className="mt-3 text-xs text-ink-soft">
                          {formatLongTimestamp(event.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyInspectorState>
                      Once the thread records notable beats, they will appear here in branch-local order.
                    </EmptyInspectorState>
                  )}
                </div>
              ) : null}

              {activeInspectorTab === "branch" ? (
                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-border bg-white/75 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                      Active branch
                    </p>
                    <p className="mt-2 font-semibold text-foreground">
                      {inspectorView.branch.activeBranchName}
                    </p>
                    <dl className="mt-4 grid gap-3 text-sm text-foreground">
                      <BranchMetric
                        label="Parent branch"
                        value={inspectorView.branch.parentBranchName ?? "Root branch"}
                      />
                      <BranchMetric
                        label="Fork checkpoint"
                        value={inspectorView.branch.forkCheckpointId ?? "Started at the root"}
                      />
                      <BranchMetric
                        label="Head checkpoint"
                        value={inspectorView.branch.headCheckpointId ?? "No assistant turn yet"}
                      />
                      <BranchMetric
                        label="Alternate replies"
                        value={String(inspectorView.branch.alternateCount)}
                      />
                      <BranchMetric
                        label="Total branches"
                        value={String(inspectorView.branch.totalBranches)}
                      />
                      <BranchMetric
                        label="Total checkpoints"
                        value={String(inspectorView.branch.totalCheckpoints)}
                      />
                    </dl>
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-white/75 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                      Available branches
                    </p>
                    <div className="mt-3 space-y-2">
                      {branches.map((branch) => (
                        <div
                          key={branch.id}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-sm",
                            branch.id === activeBranch.id
                              ? "border-brand bg-brand/8 text-brand"
                              : "border-border bg-paper text-foreground",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{branch.name}</span>
                            {branch.id === activeBranch.id ? (
                              <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
                            Updated {formatLongTimestamp(branch.updated_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
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

function ContextCard({
  eyebrow,
  title,
  helper,
  footer,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-white/75 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">{eyebrow}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{helper}</p>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function EmptyInspectorState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[1.5rem] border border-dashed border-border px-4 py-4 text-sm leading-7 text-ink-soft">
      {children}
    </p>
  );
}

function BranchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-paper px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-ink-soft">{label}</dt>
      <dd className="mt-2 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ActionSheet({
  sheet,
  pendingAction,
  onClose,
  onSubmit,
}: {
  sheet: ActionSheetState;
  pendingAction: string | null;
  onClose: () => void;
  onSubmit: (value: string, alternateCheckpointId?: string) => Promise<void>;
}) {
  const [value, setValue] = useState(
    sheet.kind === "alternates" ? "" : sheet.value,
  );

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close action sheet"
        onClick={onClose}
        className="absolute inset-0 bg-[#160f0b]/46"
      />
      <div className="absolute inset-x-3 bottom-5 mx-auto max-w-2xl rounded-[2rem] border border-border bg-[#fff8ef] p-6 shadow-[0_30px_100px_rgba(34,20,12,0.22)]">
        {sheet.kind === "alternates" ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
              Alternate picker
            </p>
            <h3 className="mt-3 font-serif text-3xl text-foreground">Choose the canonical reply</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              Selecting an alternate moves this branch head to a different sibling reply for the same latest user turn.
            </p>
            <div className="mt-5 space-y-3">
              {sheet.control.alternates.map((alternate) => (
                <button
                  key={alternate.checkpointId}
                  type="button"
                  disabled={pendingAction !== null || alternate.selected}
                  onClick={() => void onSubmit("", alternate.checkpointId)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition disabled:opacity-60",
                    alternate.selected
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-paper text-foreground hover:border-brand hover:text-brand",
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{alternate.label}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-ink-soft">
                      {alternate.selected ? "Current branch head" : "Switch this branch to this reply"}
                    </span>
                  </span>
                  {alternate.selected ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircleMore className="h-4 w-4" />}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) return;
              await onSubmit(trimmed);
            }}
          >
            <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
              {sheet.kind === "edit"
                ? "Edit last user turn"
                : sheet.kind === "branch"
                  ? "Branch from checkpoint"
                  : "Pin fact"}
            </p>
            <h3 className="mt-3 font-serif text-3xl text-foreground">
              {sheet.kind === "edit"
                ? "Fork a fresh version of that user turn"
                : sheet.kind === "branch"
                  ? "Name the new branch"
                  : "Save a branch-local memory"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              {sheet.kind === "edit"
                ? "Saving this does not rewrite history. It creates a new branch from the point before that user turn and generates a new assistant reply."
                : sheet.kind === "branch"
                  ? "This creates a clean future path from the selected checkpoint without disturbing the current branch."
                  : "Pinned facts stay local to the active branch and influence future replies on this path only."}
            </p>

            {sheet.kind === "branch" ? (
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-5 w-full rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-sm outline-none transition focus:border-brand"
                placeholder="branch-2"
              />
            ) : (
              <textarea
                rows={sheet.kind === "edit" ? 6 : 5}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-5 w-full rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-sm leading-7 outline-none transition focus:border-brand"
              />
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingAction !== null}
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
              >
                {pendingAction !== null
                  ? "Working..."
                  : sheet.kind === "edit"
                    ? "Create edited branch"
                    : sheet.kind === "branch"
                      ? "Create branch"
                      : "Save pin"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

async function throwIfFailed(response: Response, fallbackMessage: string) {
  if (response.ok) return;
  let payload: { error?: string } | null = null;
  try {
    payload = (await response.json()) as { error?: string };
  } catch {
    payload = null;
  }
  throw new Error(payload?.error ?? fallbackMessage);
}

function humanizeChatError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "That provider lane is rate limited right now. Your draft is still here, so you can retry or switch models without losing the turn.";
  }
  if (lower.includes("unauthorized") || lower.includes("auth")) {
    return "This provider lane rejected the request. Test the connection or refresh the stored key before trying again.";
  }
  if (lower.includes("network")) {
    return "The request fell over before the reply finished streaming. Retry the same draft or switch models if the lane is unstable.";
  }
  return message;
}

function formatLongTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
