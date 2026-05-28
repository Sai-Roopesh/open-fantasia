import { useState, useCallback } from "react";
import * as actions from "@/lib/api/chat-actions";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useNavTransition } from "@/components/transition-provider";
import type { EditableTurnTarget, FantasiaUIMessage } from "@/lib/types";

export function useChatActions(args: {
  threadId: string;
  branchId: string;
  headTurnId: string | null;
  setMessages: (messages: FantasiaUIMessage[] | ((prev: FantasiaUIMessage[]) => FantasiaUIMessage[])) => void;
  regenerate: (options?: { messageId?: string; body?: Record<string, any> }) => Promise<void>;
  sendMessage: (
    message: { text: string; metadata?: any },
    options?: { body?: Record<string, any> }
  ) => Promise<void>;
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
    clearPendingAction: () => setPendingAction(null),
    regenerate: async () => {
      if (!args.headTurnId) {
        throw new Error("There is no committed turn to regenerate.");
      }
      setPendingAction("regenerate");
      setSurfaceError(null);
      try {
        args.setMessages((prev) => prev.slice(0, -1));
        await args.regenerate({
          body: {
            branchId: args.branchId,
            expectedHeadTurnId: args.headTurnId,
            mode: "regenerate",
          },
        });
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
    rewind: (turnId: string, onSuccess?: () => void) =>
      runAction(
        "rewind",
        () => actions.rewindTurn(args.threadId, turnId),
        onSuccess,
      ),
    rate: (turnId: string, rating: number) =>
      runAction("rate", () => actions.rateTurn(args.threadId, turnId, rating)),
    editMessage: async (target: EditableTurnTarget, content: string) => {
      if (!args.headTurnId) {
        throw new Error("There is no committed turn to edit.");
      }

      if (target === "assistant") {
        return runAction("edit", () => {
          return actions.rewriteLatestTurn(args.threadId, {
            branchId: args.branchId,
            expectedHeadTurnId: args.headTurnId!,
            mode: "assistant",
            text: content,
          });
        });
      } else {
        setPendingAction("edit");
        setSurfaceError(null);
        try {
          args.setMessages((prev) => prev.slice(0, -2));
          await args.sendMessage(
            { text: content },
            {
              body: {
                branchId: args.branchId,
                expectedHeadTurnId: args.headTurnId!,
                mode: "user",
              },
            }
          );
        } catch (nextError) {
          setSurfaceError(
            nextError instanceof Error
              ? humanizeChatError(nextError.message)
              : "That action failed.",
          );
        } finally {
          setPendingAction(null);
        }
      }
    },
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
