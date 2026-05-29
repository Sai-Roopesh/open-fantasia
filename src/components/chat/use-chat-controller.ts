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
};

const FALLBACK_ERROR = "That action failed.";

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
  const reconcileAfterStream = useCallback(async () => {
    try {
      const result = await actions.getSlice(threadId);
      if (result.ok) {
        attemptedDraftRef.current = null;
        applySlice(result.slice, true);
        dispatch({ type: "setFailedDraft", draft: null });
      } else {
        dispatch({ type: "clearPending" });
      }
    } catch {
      // The turn committed server-side; only the reconcile read failed. Clear the
      // pending flag so the UI is usable — the streamed message is already shown.
      dispatch({ type: "clearPending" });
    }
  }, [threadId, applySlice, dispatch]);

  // Fire the reconcile exactly once per stream, on streaming/submitted -> ready.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if ((prev === "streaming" || prev === "submitted") && status === "ready") {
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
        applySlice(result.slice, options.syncMessages);
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

  const regenerateTurn = useCallback(async () => {
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
        },
      });
    } catch (nextError) {
      dispatch({ type: "mutationError", error: messageFromError(nextError) });
    }
  }, [headTurnId, activeBranchId, regenerate, setMessages, dispatch]);

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
      switchBranch,
      setSurfaceError,
    ],
  );
}
