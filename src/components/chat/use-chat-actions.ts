import { useState, useCallback } from "react";
import * as actions from "@/lib/api/chat-actions";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useNavTransition } from "@/components/transition-provider";

export function useChatActions(threadId: string) {
  const { refreshWithTransition } = useNavTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);

  const runAction = useCallback(async (
    label: string,
    callback: () => Promise<void>,
    onSuccess?: () => void,
  ) => {
    setPendingAction(label);
    setSurfaceError(null);
    try {
      await callback();
      if (onSuccess) onSuccess();
      refreshWithTransition();
    } catch (nextError) {
      setSurfaceError(
        nextError instanceof Error ? humanizeChatError(nextError.message) : "That action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }, [refreshWithTransition]);

  return {
    pendingAction,
    surfaceError,
    setSurfaceError,
    regenerate: (checkpointId: string) =>
      runAction("regenerate", () => actions.regenerateCheckpoint(threadId, checkpointId)),
    rewind: (checkpointId: string, onSuccess?: () => void) =>
      runAction("rewind", () => actions.rewindCheckpoint(threadId, checkpointId), onSuccess),
    rate: (checkpointId: string, rating: number) =>
      runAction("rate", () => actions.rateCheckpoint(threadId, checkpointId, rating)),
    selectAlternate: (checkpointId: string) =>
      runAction("alternate", () => actions.selectAlternate(threadId, checkpointId)),
    editMessage: (messageId: string, content: string) =>
      runAction("edit", () => actions.editMessage(threadId, messageId, content)),
    createBranch: (opts: { checkpointId: string; name: string }) =>
      runAction("branch", () => actions.createBranch(threadId, opts)),
    createPin: (messageId: string, body: string) =>
      runAction("pin", () => actions.createPin(threadId, messageId, body)),
    removePin: (pinId: string) =>
      runAction("unpin", () => actions.removePin(threadId, pinId)),
    triggerStarter: (starter: string, onSuccess?: () => void) =>
      runAction("starter", () => actions.triggerStarter(threadId, starter), onSuccess),
  } as const;
}
