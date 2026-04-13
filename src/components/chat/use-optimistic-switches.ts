import { useState, useCallback, useEffect } from "react";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useNavTransition } from "@/components/transition-provider";

export function useOptimisticSwitches(args: {
  threadId: string;
  setSurfaceError: (val: string | null) => void;
  switchModelAction: (input: { threadId: string; connectionId: string; modelId: string; }) => Promise<void>;
  switchBranchAction: (input: { threadId: string; branchId: string; }) => Promise<void>;
  switchPersonaAction: (input: { threadId: string; personaId: string; }) => Promise<void>;
}) {
  const { refreshWithTransition } = useNavTransition();
  const [switchPending, setSwitchPending] = useState(false);
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

  const onBranchSwitch = useCallback(async (nextBranchId: string) => {
    setOptimisticBranchId(nextBranchId);
    setSwitchPending(true);
    try {
      await args.switchBranchAction({ threadId: args.threadId, branchId: nextBranchId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticBranchId(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Branch switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, refreshWithTransition]);

  const onPersonaSwitch = useCallback(async (nextPersonaId: string) => {
    setOptimisticPersonaId(nextPersonaId);
    setSwitchPending(true);
    try {
      await args.switchPersonaAction({ threadId: args.threadId, personaId: nextPersonaId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticPersonaId(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Persona switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, refreshWithTransition]);

  const onModelSwitch = useCallback(async (connectionId: string, modelId: string, label: string) => {
    setOptimisticModel({ modelId, label });
    setSwitchPending(true);
    try {
      await args.switchModelAction({ threadId: args.threadId, connectionId, modelId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticModel(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Model switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, refreshWithTransition]);

  return {
    switchPending,
    optimisticBranchId,
    optimisticPersonaId,
    optimisticModel,
    onBranchSwitch,
    onPersonaSwitch,
    onModelSwitch,
  };
}
