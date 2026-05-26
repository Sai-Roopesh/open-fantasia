import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";

export function useOptimisticSwitches(args: {
  threadId: string;
  setSurfaceError: (val: string | null) => void;
  switchModelAction: (input: { threadId: string; connectionId: string; modelId: string; }) => Promise<void>;
  switchBrainModelAction: (input: { threadId: string; connectionId: string | null; modelId: string | null; }) => Promise<void>;
  switchBranchAction: (input: { threadId: string; branchId: string; }) => Promise<void>;
  switchPersonaAction: (input: { threadId: string; personaId: string; }) => Promise<void>;
}) {
  const router = useRouter();
  const [switchPending, setSwitchPending] = useState(false);
  const [optimisticBranchId, setOptimisticBranchId] = useState<string | null>(null);
  const [optimisticPersonaId, setOptimisticPersonaId] = useState<string | null>(null);
  const [optimisticModel, setOptimisticModel] = useState<{ modelId: string; label: string } | null>(null);
  const [optimisticBrainModel, setOptimisticBrainModel] = useState<{ connectionId: string | null; modelId: string | null } | null>(null);

  // Reset optimistic state when server props arrive (switchPending goes false)
  useEffect(() => {
    if (!switchPending) {
      setOptimisticBranchId(null);
      setOptimisticPersonaId(null);
      setOptimisticModel(null);
      setOptimisticBrainModel(null);
    }
  }, [switchPending]);

  const onBranchSwitch = useCallback(async (nextBranchId: string) => {
    setOptimisticBranchId(nextBranchId);
    setSwitchPending(true);
    try {
      await args.switchBranchAction({ threadId: args.threadId, branchId: nextBranchId });
      router.refresh();
    } catch (error) {
      setOptimisticBranchId(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Branch switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, router]);

  const onPersonaSwitch = useCallback(async (nextPersonaId: string) => {
    setOptimisticPersonaId(nextPersonaId);
    setSwitchPending(true);
    try {
      await args.switchPersonaAction({ threadId: args.threadId, personaId: nextPersonaId });
      router.refresh();
    } catch (error) {
      setOptimisticPersonaId(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Persona switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, router]);

  const onModelSwitch = useCallback(async (connectionId: string, modelId: string, label: string) => {
    setOptimisticModel({ modelId, label });
    setSwitchPending(true);
    try {
      await args.switchModelAction({ threadId: args.threadId, connectionId, modelId });
      router.refresh();
    } catch (error) {
      setOptimisticModel(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Model switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, router]);

  const onBrainModelSwitch = useCallback(async (connectionId: string | null, modelId: string | null) => {
    setOptimisticBrainModel({ connectionId, modelId });
    setSwitchPending(true);
    try {
      await args.switchBrainModelAction({ threadId: args.threadId, connectionId, modelId });
      router.refresh();
    } catch (error) {
      setOptimisticBrainModel(null);
      args.setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Brain model switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [args, router]);

  return {
    switchPending,
    optimisticBranchId,
    optimisticPersonaId,
    optimisticModel,
    optimisticBrainModel,
    onBranchSwitch,
    onPersonaSwitch,
    onModelSwitch,
    onBrainModelSwitch,
  };
}
