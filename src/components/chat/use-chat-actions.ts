import { useState, useCallback } from "react";
import * as actions from "@/lib/api/chat-actions";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useNavTransition } from "@/components/transition-provider";

export function useChatActions(args: {
  threadId: string;
  branchId: string;
  headTurnId: string | null;
}) {
  const { refreshWithTransition } = useNavTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);

  const runAction = useCallback(
    async (
      label: string,
      callback: () => Promise<void>,
      onSuccess?: () => void,
    ) => {
      setPendingAction(label);
      setSurfaceError(null);
      try {
        await callback();
        if (onSuccess) {
          onSuccess();
        }
        refreshWithTransition();
      } catch (nextError) {
        setSurfaceError(
          nextError instanceof Error
            ? humanizeChatError(nextError.message)
            : "That action failed.",
        );
      } finally {
        setPendingAction(null);
      }
    },
    [refreshWithTransition],
  );

  return {
    pendingAction,
    surfaceError,
    setSurfaceError,
    regenerate: (turnId: string) =>
      runAction("regenerate", () => {
        if (!args.headTurnId) {
          throw new Error("There is no committed turn to regenerate.");
        }
        return actions.regenerateTurn(args.threadId, args.branchId, args.headTurnId);
      }),
    rewind: (turnId: string, onSuccess?: () => void) =>
      runAction(
        "rewind",
        () => actions.rewindTurn(args.threadId, turnId, args.branchId),
        onSuccess,
      ),
    rate: (turnId: string, rating: number) =>
      runAction("rate", () => actions.rateTurn(args.threadId, turnId, rating)),
    editMessage: (_messageId: string, content: string) =>
      runAction("edit", () => {
        if (!args.headTurnId) {
          throw new Error("There is no committed turn to edit.");
        }
        return actions.editLatestTurn(
          args.threadId,
          args.branchId,
          args.headTurnId,
          content,
        );
      }),
    createBranch: (opts: { sourceTurnId: string; name: string }) =>
      runAction("branch", () => actions.createBranch(args.threadId, opts)),
    createPin: (turnId: string, body: string) =>
      runAction("pin", () => actions.createPin(args.threadId, turnId, body)),
    removePin: (pinId: string) =>
      runAction("unpin", () => actions.removePin(args.threadId, pinId)),
    triggerStarter: (starter: string, onSuccess?: () => void) =>
      runAction("starter", () => actions.triggerStarter(args.threadId, starter), onSuccess),
  } as const;
}
