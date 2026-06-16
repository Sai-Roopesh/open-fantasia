"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { MAX_CHAT_TURN_TEXT, buildChatTurnTrimMessage } from "@/lib/chat-limits";
import type {
  BranchTreeNode,
  ChatBranchRecord,
  ContinuityInspectorView,
  EditableTurnTarget,
  FantasiaUIMessage,
  MutationResult,
  ThreadSettingsSlice,
  TranscriptControl,
  UserPersonaRecord,
} from "@/lib/types";
import { getBranchTranscript } from "@/lib/api/chat-actions";
import { getTextFromMessage } from "@/lib/utils/message-text";
import { ChatLayout } from "@/components/chat/chat-workspace-shell";
import {
  ContinuityBanner,
  ErrorBanner,
} from "@/components/chat/chat-composer-ui";
import { ChatProvider } from "@/components/chat/chat-provider";
import { useChatController } from "@/components/chat/use-chat-controller";
import { ActionSheet } from "@/components/chat/chat-action-ui";
import type {
  ActionSheetState,
  InspectorTab,
  ModelChoiceGroup,
} from "@/components/chat/chat-ui-types";

type SwitchActions = {
  switchModelAction: (input: { threadId: string; connectionId: string; modelId: string; }) => Promise<MutationResult>;
  switchBranchAction: (input: { threadId: string; branchId: string; }) => Promise<MutationResult>;
  switchPersonaAction: (input: { threadId: string; personaId: string; }) => Promise<MutationResult>;
  switchBrainModelAction: (input: { threadId: string; connectionId: string | null; modelId: string | null; }) => Promise<MutationResult>;
  switchTokensAction: (input: { threadId: string; maxOutputTokens: number; }) => Promise<MutationResult>;
  switchDirectorNotesAction: (input: { threadId: string; directorNotes: string; }) => Promise<MutationResult>;
};

type ChatWorkspaceProps = SwitchActions & {
  threadId: string;
  characterName: string;
  characterBackgroundUrl?: string | null;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  branchTree: BranchTreeNode[];
  personas: UserPersonaRecord[];
  initialMessages: FantasiaUIMessage[];
  controlsByMessageId: Record<string, TranscriptControl>;
  inspectorView: ContinuityInspectorView;
  settings: ThreadSettingsSlice;
  suggestedStarters: string[];
  modelChoices: ModelChoiceGroup[];
};

export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <ChatProvider
      threadId={props.threadId}
      initialMessages={props.initialMessages}
      seed={{
        controlsByMessageId: props.controlsByMessageId,
        inspectorView: props.inspectorView,
        activeBranch: props.activeBranch,
        branches: props.branches,
        branchTree: props.branchTree,
        settings: props.settings,
      }}
    >
      <ChatWorkspaceInner {...props} />
    </ChatProvider>
  );
}

function ChatWorkspaceInner({
  threadId,
  characterName,
  characterBackgroundUrl,
  personas,
  modelChoices,
  suggestedStarters,
  switchModelAction,
  switchBranchAction,
  switchPersonaAction,
  switchBrainModelAction,
  switchTokensAction,
  switchDirectorNotesAction,
}: ChatWorkspaceProps) {
  const controller = useChatController({
    switchModelAction,
    switchPersonaAction,
    switchBranchAction,
    switchBrainModelAction,
    switchTokensAction,
    switchDirectorNotesAction,
  });

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("continuity");
  const [sheet, setSheet] = useState<ActionSheetState | null>(null);
  const { confirm: confirmRewind, confirmDialog: rewindConfirmDialog } = useConfirmation();

  const [portraitState, setPortraitState] = useState<"idle" | "ready" | "error">(
    characterBackgroundUrl ? "idle" : "error",
  );
  const [lastUrl, setLastUrl] = useState(characterBackgroundUrl);
  if (characterBackgroundUrl !== lastUrl) {
    setLastUrl(characterBackgroundUrl);
    setPortraitState(characterBackgroundUrl ? "idle" : "error");
  }

  const {
    messages,
    status,
    error,
    controlsByMessageId,
    inspectorView,
    branches,
    branchTree,
    displaySettings,
    displayBranchId,
    pendingAction,
    switchPending,
    surfaceError,
    failedDraft,
  } = controller;

  // When a send fails, the controller preserves the failed text in the store
  // (stream errors surface asynchronously via status, not via the submit promise).
  // Sync that signal back into the local composer draft and refocus, only if the
  // user hasn't already started a fresh draft. This is a legitimate
  // "subscribe to external state -> update local UI" effect.
  const lastFailedDraftRef = useRef<string | null>(null);
  useEffect(() => {
    if (failedDraft && failedDraft !== lastFailedDraftRef.current) {
      lastFailedDraftRef.current = failedDraft;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((current) => (current.trim().length ? current : failedDraft));
      requestAnimationFrame(() => composerRef.current?.focus());
    } else if (!failedDraft) {
      lastFailedDraftRef.current = null;
    }
  }, [failedDraft]);

  const activeError =
    surfaceError ?? (error ? humanizeChatError(error.message) : null);
  const continuityStatus = inspectorView.continuityStatus;
  const rewriteBlocked = continuityStatus?.tone === "pending";
  const composerContinuityBlocked = Boolean(continuityStatus);
  const composerBusy =
    status === "streaming" ||
    status === "submitted" ||
    pendingAction !== null ||
    switchPending ||
    composerContinuityBlocked;

  // Show the "is typing" dots from the moment a turn is sent until the first
  // streamed token lands. Once the assistant message has visible text the live
  // streaming bubble takes over, so the indicator is hidden.
  const lastMessage = messages[messages.length - 1];
  const awaitingReply =
    (status === "submitted" || status === "streaming") &&
    (!lastMessage ||
      lastMessage.role !== "assistant" ||
      getTextFromMessage(lastMessage).length === 0);

  const displayModel = displaySettings.model.modelId;
  const displayConnectionLabel = displaySettings.model.label;

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
        .filter((option) => option.model.id !== displayModel)
        .slice(0, 5),
    [displayModel, modelChoices],
  );

  async function submitCurrentDraft(value: string) {
    const nextValue = value.trim();
    if (!nextValue) return;
    if (nextValue.length > MAX_CHAT_TURN_TEXT) {
      controller.setSurfaceError(buildChatTurnTrimMessage(nextValue.length));
      requestAnimationFrame(() => composerRef.current?.focus());
      return;
    }

    setDraft("");
    await controller.submit(nextValue);
  }

  function openBranchSheet(turnId: string) {
    setSheet({
      kind: "branch",
      turnId,
      value: `branch-${branches.length + 1}`,
    });
  }

  const transcriptProps = {
    messages,
    assistantLabel: characterName,
    controlsByMessageId,
    pendingAction,
    awaitingReply,
    rewriteBlocked,
    onRegenerate: async () => setSheet({ kind: "regenerate", value: "" }),
    onOpenEditMessage: (
      messageId: string,
      currentText: string,
      target: EditableTurnTarget,
    ) => setSheet({ kind: "edit", target, messageId, value: currentText }),
    onOpenBranchFromCheckpoint: openBranchSheet,
    onRewindCheckpoint: async (turnId: string) => {
      confirmRewind({
        title: "Rewind to this turn?",
        description:
          "This permanently deletes the current-path descendants from here, including branches forked from them.",
        confirmLabel: "Rewind",
        variant: "destructive",
        onConfirm: () => {
          void controller.rewind(turnId, () => {
            requestAnimationFrame(() => composerRef.current?.focus());
          });
        },
      });
    },
    onOpenPinMessage: (messageId: string, currentText: string) =>
      setSheet({ kind: "pin", messageId, value: currentText }),
    onRateCheckpoint: controller.rate,
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

  return (
    <>
      <ChatLayout
        characterName={characterName}
        characterBackgroundUrl={characterBackgroundUrl}
        portraitState={portraitState}
        onPortraitLoad={() => setPortraitState("ready")}
        onPortraitError={() => setPortraitState("error")}
        displayConnectionLabel={displayConnectionLabel}
        displayModel={displayModel}
        showModelPicker={showModelPicker}
        setShowModelPicker={setShowModelPicker}
        displayBranchId={displayBranchId}
        branches={branches}
        switchPending={switchPending}
        onBranchSwitch={controller.switchBranch}
        displayPersonaId={displaySettings.personaId}
        personas={personas}
        onPersonaSwitch={controller.switchPersona}
        currentModel={displayModel}
        currentConnectionLabel={displayConnectionLabel}
        modelChoices={modelChoices}
        messagesLength={messages.length}
        composerBusy={composerBusy}
        suggestedStarters={suggestedStarters}
        triggerStarter={(starter, onSuccess) =>
          void controller.triggerStarter(starter, onSuccess)
        }
        transcriptProps={transcriptProps}
        continuityBannerBlock={continuityBannerBlock}
        errorBannerBlock={errorBannerBlock}
        composerProps={composerProps}
        branchTree={branchTree}
        onCopyTranscript={() => getBranchTranscript(threadId)}
        activeInspectorTab={activeInspectorTab}
        inspectorView={inspectorView}
        pendingAction={pendingAction}
        removePin={controller.removePin}
        setActiveInspectorTab={setActiveInspectorTab}
        onModelSwitch={controller.switchModel}
        currentBrainConnectionId={displaySettings.brain.connectionId}
        currentBrainModelId={displaySettings.brain.modelId}
        optimisticBrainModel={null}
        onBrainModelSwitch={controller.switchBrainModel}
        maxOutputTokens={displaySettings.maxOutputTokens}
        onTokensSwitch={controller.switchTokens}
        directorNotes={displaySettings.directorNotes}
        onDirectorNotesChange={controller.switchDirectorNotes}
      />

      {sheet ? (
        <ActionSheet
          key={
            sheet.kind === "branch"
              ? `branch-${sheet.turnId}`
              : sheet.kind === "edit"
                ? `edit-${sheet.messageId}`
                : sheet.kind === "pin"
                  ? `pin-${sheet.messageId}`
                  : "regenerate"
          }
          sheet={sheet}
          pendingAction={pendingAction}
          onClose={() => setSheet(null)}
          onSubmit={async (value) => {
            if (sheet.kind === "edit") {
              await controller.editMessage(sheet.target, value);
            } else if (sheet.kind === "branch") {
              await controller.createBranch({ sourceTurnId: sheet.turnId, name: value });
            } else if (sheet.kind === "regenerate") {
              setSheet(null);
              await controller.regenerate(value || undefined);
              return;
            } else {
              const turnId = controlsByMessageId[sheet.messageId]?.turnId;
              if (!turnId) {
                throw new Error("Fantasia could not find the source turn for this pin.");
              }
              await controller.createPin(turnId, value);
            }
            setSheet(null);
          }}
        />
      ) : null}
      {rewindConfirmDialog}
    </>
  );
}
