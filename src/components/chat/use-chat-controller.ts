"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as actions from "@/lib/api/chat-actions";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import {
  selectDisplayBranchId,
  selectDisplaySettings,
} from "@/components/chat/chat-store";
import { useChatContext } from "@/components/chat/chat-provider";
import type {
  EditableTurnTarget,
  FantasiaUIMessage,
  MutationResult,
  TurnSlicePatch,
} from "@/lib/types";

type SwitchActions = {
  switchModelAction: (input: {
    threadId: string;
    connectionId: string;
    modelId: string;
  }) => Promise<MutationResult>;
  switchPersonaAction: (input: {
    threadId: string;
    personaId: string;
  }) => Promise<MutationResult>;
  switchBranchAction: (input: {
    threadId: string;
    branchId: string;
  }) => Promise<MutationResult>;
  switchBrainModelAction: (input: {
    threadId: string;
    connectionId: string | null;
    modelId: string | null;
  }) => Promise<MutationResult>;
  switchTokensAction: (input: {
    threadId: string;
    maxOutputTokens: number;
  }) => Promise<MutationResult>;
  switchDirectorNotesAction: (input: {
    threadId: string;
    directorNotes: string;
  }) => Promise<MutationResult>;
};

const FALLBACK_ERROR = "That action failed.";

// The turn is committed to the DB inside the model stream's `onFinish`, which is
// not awaited before the HTTP stream closes. So a read fired the instant the
// stream settles can race the commit; we poll briefly until it lands.
const RECONCILE_MAX_ATTEMPTS = 10;
const RECONCILE_RETRY_MS = 250;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageFromError(error: unknown, fallback = FALLBACK_ERROR) {
  return error instanceof Error ? humanizeChatError(error.message) : fallback;
}

/**
 * The single hook the chat workspace uses. It composes the streaming `Chat`
 * instance (via `useChat`) with the auxiliary store, and exposes derived display
 * values plus every mutation handler.
 *
 * Reactivity model:
 * - Streaming turns (send / regenerate / edit-user) flow through `useChat`. When
 *   the stream settles, a status-watching effect fetches the authoritative slice
 *   and reconciles messages + aux — the streamed assistant id matches the
 *   committed id, so the swap is identity-stable (no flash).
 * - Every other mutation returns a slice that is applied directly. No mutation
 *   relies on `router.refresh()`.
 */
export function useChatController(switchActions: SwitchActions) {
  const { threadId, chat, state, dispatch } = useChatContext();
  const { messages, sendMessage, regenerate, status, error, setMessages } =
    useChat<FantasiaUIMessage>({ chat, experimental_throttle: 33 });

  const headTurnId = state.activeBranch.head_turn_id;
  const activeBranchId = state.activeBranch.id;
  const displaySettings = selectDisplaySettings(state);
  const displayBranchId = selectDisplayBranchId(state);

  // Tracks the text of an in-flight send so a failed stream can offer it back.
  const attemptedDraftRef = useRef<string | null>(null);

  const applySlice = useCallback(
    (slice: TurnSlicePatch, syncMessages: boolean) => {
      if (syncMessages) {
        setMessages(slice.messages);
      }
      dispatch({ type: "applySlice", slice });
    },
    [setMessages, dispatch],
  );

  // Read-your-writes reconcile after a streaming turn finishes.
  //
  // The streamed assistant message already carries its committed id
  // (`${turnId}:assistant`, set server-side). Because the DB commit happens in the
  // stream's `onFinish` — which is not awaited before the HTTP stream closes — a
  // slice read fired the instant `status` flips to `ready` can come back BEFORE the
  // commit is visible, returning the previous transcript. Applying that via
  // `setMessages` would blank the reply we just streamed (it would only reappear on
  // a manual refresh). So we poll until the slice echoes back the streamed turn,
  // then swap to server truth. The streamed message stays on screen throughout.
  const reconcileAfterStream = useCallback(async () => {
    const streamedAssistantId =
      [...chat.messages].reverse().find((message) => message.role === "assistant")?.id ??
      null;

    for (let attempt = 0; attempt < RECONCILE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await actions.getSlice(threadId);
        if (result.ok) {
          const sliceHasStreamedTurn =
            streamedAssistantId === null ||
            result.slice.messages.some((message) => message.id === streamedAssistantId);
          if (sliceHasStreamedTurn) {
            attemptedDraftRef.current = null;
            applySlice(result.slice, true);
            dispatch({ type: "setFailedDraft", draft: null });
            // The turn actually landed — clear any error surfaced by an aborted
            // or timed-out stream so the reply isn't accompanied by a stale banner.
            dispatch({ type: "setError", error: null });
            return;
          }
        }
      } catch {
        // Transient read failure — retry. The streamed message is still on screen.
      }
      if (attempt < RECONCILE_MAX_ATTEMPTS - 1) {
        await delay(RECONCILE_RETRY_MS);
      }
    }

    // The commit never became visible within the retry budget. The streamed
    // message is already shown, so just release the pending flag — never blank it.
    dispatch({ type: "clearPending" });
  }, [threadId, chat, applySlice, dispatch]);

  // Fire the reconcile exactly once per stream, on streaming/submitted -> ready
  // OR -> error. Reconciling on error too is what makes the UI self-heal when the
  // stream is aborted (e.g. a serverless timeout): the turn is already committed,
  // so the reconcile pulls it in instead of leaving the user to refresh.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      (prev === "streaming" || prev === "submitted") &&
      (status === "ready" || status === "error")
    ) {
      void reconcileAfterStream();
    }
  }, [status, reconcileAfterStream]);

  // Surface stream errors and preserve the failed draft for retry.
  useEffect(() => {
    if (status !== "error") {
      return;
    }
    dispatch({
      type: "mutationError",
      error: error ? humanizeChatError(error.message) : "We couldn't complete that turn.",
    });
    if (attemptedDraftRef.current) {
      dispatch({ type: "setFailedDraft", draft: attemptedDraftRef.current });
    }
  }, [status, error, dispatch]);

  // While continuity reconciliation is pending, poll the authoritative slice so
  // the banner clears on its own (replacing the old blind router.refresh loop).
  const continuityPending = state.inspectorView.continuityStatus?.tone === "pending";
  const isBusy = status !== "ready" || state.pendingAction !== null || state.switchPending;
  useEffect(() => {
    if (!continuityPending || isBusy) {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const result = await actions.getSlice(threadId);
        if (result.ok) {
          // Continuity completion doesn't change the transcript, only aux state.
          dispatch({ type: "applySlice", slice: result.slice });
        }
      } catch {
        // Ignore; the next tick retries.
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [continuityPending, isBusy, threadId, dispatch]);

  // Generic runner for non-streaming, slice-returning mutations.
  const runMutation = useCallback(
    async (
      label: string,
      run: () => Promise<MutationResult>,
      options: { syncMessages: boolean; onSuccess?: () => void },
    ) => {
      dispatch({ type: "mutationStart", label });
      try {
        const result = await run();
        if (!result.ok) {
          dispatch({ type: "mutationError", error: result.error });
          return;
        }
        // Lightweight mutations (e.g. rate) ack without a read-your-writes slice;
        // there is nothing to reconcile, so only apply when a slice is present.
        if (result.slice) {
          applySlice(result.slice, options.syncMessages);
        }
        options.onSuccess?.();
      } catch (nextError) {
        dispatch({ type: "mutationError", error: messageFromError(nextError) });
      }
    },
    [applySlice, dispatch],
  );

  // ---- Streaming handlers -------------------------------------------------

  const submit = useCallback(
    async (text: string) => {
      attemptedDraftRef.current = text;
      dispatch({ type: "mutationStart", label: "send" });
      try {
        await sendMessage(
          { text },
          { body: { branchId: displayBranchId, expectedHeadTurnId: headTurnId } },
        );
      } catch (nextError) {
        attemptedDraftRef.current = null;
        dispatch({
          type: "mutationError",
          error: messageFromError(nextError, "We couldn't send that turn."),
        });
        dispatch({ type: "setFailedDraft", draft: text });
      }
    },
    [sendMessage, displayBranchId, headTurnId, dispatch],
  );

  const regenerateTurn = useCallback(
    async (guidance?: string) => {
      if (!headTurnId) {
        dispatch({ type: "setError", error: "There is no committed turn to regenerate." });
        return;
      }
      dispatch({ type: "mutationStart", label: "regenerate" });
      setMessages((prev) => prev.slice(0, -1));
      try {
        await regenerate({
          body: {
            branchId: activeBranchId,
            expectedHeadTurnId: headTurnId,
            mode: "regenerate",
            guidance: guidance?.trim() || undefined,
          },
        });
      } catch (nextError) {
        dispatch({ type: "mutationError", error: messageFromError(nextError) });
      }
    },
    [headTurnId, activeBranchId, regenerate, setMessages, dispatch],
  );

  const editMessage = useCallback(
    async (target: EditableTurnTarget, content: string) => {
      if (!headTurnId) {
        dispatch({ type: "setError", error: "There is no committed turn to edit." });
        return;
      }

      if (target === "assistant") {
        await runMutation(
          "edit",
          () =>
            actions.rewriteLatestTurn(threadId, {
              branchId: activeBranchId,
              expectedHeadTurnId: headTurnId,
              mode: "assistant",
              text: content,
            }),
          { syncMessages: true },
        );
        return;
      }

      dispatch({ type: "mutationStart", label: "edit" });
      setMessages((prev) => prev.slice(0, -2));
      try {
        await sendMessage(
          { text: content },
          {
            body: {
              branchId: activeBranchId,
              expectedHeadTurnId: headTurnId,
              mode: "user",
            },
          },
        );
      } catch (nextError) {
        dispatch({ type: "mutationError", error: messageFromError(nextError) });
      }
    },
    [headTurnId, activeBranchId, threadId, runMutation, sendMessage, setMessages, dispatch],
  );

  // ---- Slice-returning handlers ------------------------------------------

  const rewind = useCallback(
    (turnId: string, onSuccess?: () => void) =>
      runMutation("rewind", () => actions.rewindTurn(threadId, turnId), {
        syncMessages: true,
        onSuccess,
      }),
    [runMutation, threadId],
  );

  const rate = useCallback(
    (turnId: string, rating: number) =>
      runMutation("rate", () => actions.rateTurn(threadId, turnId, rating), {
        syncMessages: false,
      }),
    [runMutation, threadId],
  );

  const createBranch = useCallback(
    (opts: { sourceTurnId: string; name: string }) =>
      runMutation("branch", () => actions.createBranch(threadId, opts), {
        syncMessages: true,
      }),
    [runMutation, threadId],
  );

  const createPin = useCallback(
    (turnId: string, body: string) =>
      runMutation("pin", () => actions.createPin(threadId, turnId, body), {
        syncMessages: false,
      }),
    [runMutation, threadId],
  );

  const removePin = useCallback(
    (pinId: string) =>
      runMutation("unpin", () => actions.removePin(threadId, pinId), {
        syncMessages: false,
      }),
    [runMutation, threadId],
  );

  const triggerStarter = useCallback(
    (starter: string, onSuccess?: () => void) =>
      runMutation("starter", () => actions.triggerStarter(threadId, starter), {
        syncMessages: true,
        onSuccess,
      }),
    [runMutation, threadId],
  );

  // ---- Settings / branch switches (optimistic) ---------------------------

  // Runs a switch action that has already had its optimistic overlay dispatched,
  // then reconciles to the authoritative slice (or reverts on failure).
  const runSwitch = useCallback(
    async (run: () => Promise<MutationResult>, syncMessages: boolean) => {
      try {
        const result = await run();
        if (!result.ok) {
          dispatch({ type: "switchError", error: result.error });
          return;
        }
        applySlice(result.slice, syncMessages);
      } catch (nextError) {
        dispatch({ type: "switchError", error: messageFromError(nextError) });
      }
    },
    [applySlice, dispatch],
  );

  const switchModel = useCallback(
    async (connectionId: string, modelId: string, label: string) => {
      dispatch({ type: "switchStart", settings: { model: { connectionId, modelId, label } } });
      await runSwitch(
        () => switchActions.switchModelAction({ threadId, connectionId, modelId }),
        false,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const switchPersona = useCallback(
    async (personaId: string) => {
      dispatch({ type: "switchStart", settings: { personaId } });
      await runSwitch(
        () => switchActions.switchPersonaAction({ threadId, personaId }),
        false,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const switchBrainModel = useCallback(
    async (connectionId: string | null, modelId: string | null) => {
      dispatch({ type: "switchStart", settings: { brain: { connectionId, modelId } } });
      await runSwitch(
        () => switchActions.switchBrainModelAction({ threadId, connectionId, modelId }),
        false,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const switchTokens = useCallback(
    async (maxOutputTokens: number) => {
      dispatch({ type: "switchStart", settings: { maxOutputTokens } });
      await runSwitch(
        () => switchActions.switchTokensAction({ threadId, maxOutputTokens }),
        false,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const switchDirectorNotes = useCallback(
    async (directorNotes: string) => {
      dispatch({ type: "switchStart", settings: { directorNotes } });
      await runSwitch(
        () => switchActions.switchDirectorNotesAction({ threadId, directorNotes }),
        false,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const switchBranch = useCallback(
    async (branchId: string) => {
      dispatch({ type: "switchStart", branchId });
      await runSwitch(
        () => switchActions.switchBranchAction({ threadId, branchId }),
        true,
      );
    },
    [dispatch, runSwitch, switchActions, threadId],
  );

  const setSurfaceError = useCallback(
    (value: string | null) => dispatch({ type: "setError", error: value }),
    [dispatch],
  );

  return useMemo(
    () => ({
      // streaming substrate
      messages,
      status,
      error,
      // reconcilable aux
      controlsByMessageId: state.controlsByMessageId,
      inspectorView: state.inspectorView,
      branches: state.branches,
      branchTree: state.branchTree,
      activeBranch: state.activeBranch,
      // derived display
      displaySettings,
      displayBranchId,
      // ui status
      pendingAction: state.pendingAction,
      switchPending: state.switchPending,
      surfaceError: state.surfaceError,
      failedDraft: state.failedDraft,
      // handlers
      submit,
      regenerate: regenerateTurn,
      editMessage,
      rewind,
      rate,
      createBranch,
      createPin,
      removePin,
      triggerStarter,
      switchModel,
      switchPersona,
      switchBrainModel,
      switchTokens,
      switchDirectorNotes,
      switchBranch,
      setSurfaceError,
    }),
    [
      messages,
      status,
      error,
      state.controlsByMessageId,
      state.inspectorView,
      state.branches,
      state.branchTree,
      state.activeBranch,
      displaySettings,
      displayBranchId,
      state.pendingAction,
      state.switchPending,
      state.surfaceError,
      state.failedDraft,
      submit,
      regenerateTurn,
      editMessage,
      rewind,
      rate,
      createBranch,
      createPin,
      removePin,
      triggerStarter,
      switchModel,
      switchPersona,
      switchBrainModel,
      switchTokens,
      switchDirectorNotes,
      switchBranch,
      setSurfaceError,
    ],
  );
}
