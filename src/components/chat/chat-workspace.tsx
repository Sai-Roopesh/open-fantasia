"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavTransition } from "@/components/transition-provider";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  FantasiaUIMessage,
  TranscriptControl,
  UserPersonaRecord,
} from "@/lib/types";
import { messageMetadataSchema } from "@/lib/types";
import {
  ChatFocusOverlay,
  ChatScenePanel,
} from "@/components/chat/chat-workspace-shell";
import {
  ContinuityBanner,
  ErrorBanner,
} from "@/components/chat/chat-composer-ui";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useChatActions } from "@/components/chat/use-chat-actions";
import { useOptimisticSwitches } from "@/components/chat/use-optimistic-switches";
import { ActionSheet } from "@/components/chat/chat-action-ui";
import type {
  ActionSheetState,
  InspectorTab,
  ModelChoiceGroup,
} from "@/components/chat/chat-ui-types";

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
  const { refreshWithTransition } = useNavTransition();
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

  const alternativeModels = useMemo(
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
  const continuityStatus = inspectorView.continuityStatus;
  const composerContinuityBlocked = Boolean(continuityStatus);
  const rewriteBlocked = continuityStatus?.tone === "pending";
  const composerBusy =
    status === "streaming" ||
    status === "submitted" ||
    pendingAction !== null ||
    switchPending ||
    composerContinuityBlocked;

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
    rewriteBlocked,
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
      alternativeModels={alternativeModels}
      onEditDraft={(value) => {
        setDraft(value);
        requestAnimationFrame(() => composerRef.current?.focus());
      }}
      onRetry={(value) => void submitCurrentDraft(value)}
      onShowModelPicker={() => setShowModelPicker(true)}
    />
  ) : null;
  const continuityBannerBlock = continuityStatus ? (
    <ContinuityBanner status={continuityStatus} />
  ) : null;
  const focusBackdropColor = portraitState === "ready" ? "#120f0d" : "#0f0c0a";

  return (
    <>
      <ChatFocusOverlay
        focusMode={focusMode}
        toggleFocusMode={toggleFocusMode}
        focusBackdropColor={focusBackdropColor}
        portraitState={portraitState}
        onPortraitLoad={() => setPortraitState("ready")}
        onPortraitError={() => setPortraitState("error")}
        characterBackgroundUrl={characterBackgroundUrl}
        characterName={characterName}
        displayConnectionLabel={displayConnectionLabel}
        displayModel={displayModel}
        transcriptProps={transcriptProps}
        continuityBannerBlock={continuityBannerBlock}
        errorBannerBlock={errorBannerBlock}
        composerProps={composerProps}
      />

      <ChatScenePanel
        focusMode={focusMode}
        characterName={characterName}
        displayConnectionLabel={displayConnectionLabel}
        displayModel={displayModel}
        showModelPicker={showModelPicker}
        setShowModelPicker={setShowModelPicker}
        toggleFocusMode={toggleFocusMode}
        displayBranchId={displayBranchId}
        branches={branches}
        switchPending={switchPending}
        onBranchSwitch={onBranchSwitch}
        displayPersonaId={displayPersonaId}
        personas={personas}
        onPersonaSwitch={onPersonaSwitch}
        currentModel={currentModel}
        currentConnectionLabel={currentConnectionLabel}
        modelChoices={modelChoices}
        messagesLength={messages.length}
        composerBusy={composerBusy}
        suggestedStarters={suggestedStarters}
        triggerStarter={triggerStarter}
        transcriptProps={transcriptProps}
        continuityBannerBlock={continuityBannerBlock}
        errorBannerBlock={errorBannerBlock}
        composerProps={composerProps}
        activeBranch={activeBranch}
        activeInspectorTab={activeInspectorTab}
        inspectorView={inspectorView}
        pendingAction={pendingAction}
        removePin={removePin}
        setActiveInspectorTab={setActiveInspectorTab}
        onModelSwitch={onModelSwitch}
      />

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
