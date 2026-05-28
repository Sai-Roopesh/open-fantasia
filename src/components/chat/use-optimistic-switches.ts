import { useState, useCallback, useEffect } from "react";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";
import { useNavTransition } from "@/components/transition-provider";

export function useOptimisticSwitches({
  threadId,
  setSurfaceError,
  switchModelAction,
  switchBrainModelAction,
  switchBranchAction,
  switchPersonaAction,
  switchTokensAction,
}: {
  threadId: string;
  setSurfaceError: (val: string | null) => void;
  switchModelAction: (input: { threadId: string; connectionId: string; modelId: string; }) => Promise<void>;
  switchBrainModelAction: (input: { threadId: string; connectionId: string | null; modelId: string | null; }) => Promise<void>;
  switchBranchAction: (input: { threadId: string; branchId: string; }) => Promise<void>;
  switchPersonaAction: (input: { threadId: string; personaId: string; }) => Promise<void>;
  switchTokensAction: (input: { threadId: string; maxOutputTokens: number; }) => Promise<void>;
}) {
  const { refreshWithTransition } = useNavTransition();
  const [switchPending, setSwitchPending] = useState(false);
  const [optimisticBranchId, setOptimisticBranchId] = useState<string | null>(null);
  const [optimisticPersonaId, setOptimisticPersonaId] = useState<string | null>(null);
  const [optimisticModel, setOptimisticModel] = useState<{ modelId: string; label: string } | null>(null);
  const [optimisticBrainModel, setOptimisticBrainModel] = useState<{ connectionId: string | null; modelId: string | null } | null>(null);
  const [optimisticTokens, setOptimisticTokens] = useState<number | null>(null);

  // Reset optimistic state when server props arrive (switchPending goes false)
  useEffect(() => {
    if (!switchPending) {
      setOptimisticBranchId(null);
      setOptimisticPersonaId(null);
      setOptimisticModel(null);
      setOptimisticBrainModel(null);
      setOptimisticTokens(null);
    }
  }, [switchPending]);

  const onBranchSwitch = useCallback(async (nextBranchId: string) => {
    setOptimisticBranchId(nextBranchId);
    setSwitchPending(true);
    try {
      await switchBranchAction({ threadId, branchId: nextBranchId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticBranchId(null);
      setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Branch switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [threadId, switchBranchAction, refreshWithTransition, setSurfaceError]);

  const onPersonaSwitch = useCallback(async (nextPersonaId: string) => {
    setOptimisticPersonaId(nextPersonaId);
    setSwitchPending(true);
    try {
      await switchPersonaAction({ threadId, personaId: nextPersonaId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticPersonaId(null);
      setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Persona switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [threadId, switchPersonaAction, refreshWithTransition, setSurfaceError]);

  const onModelSwitch = useCallback(async (connectionId: string, modelId: string, label: string) => {
    setOptimisticModel({ modelId, label });
    setSwitchPending(true);
    try {
      await switchModelAction({ threadId, connectionId, modelId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticModel(null);
      setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Model switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [threadId, switchModelAction, refreshWithTransition, setSurfaceError]);

  const onBrainModelSwitch = useCallback(async (connectionId: string | null, modelId: string | null) => {
    setOptimisticBrainModel({ connectionId, modelId });
    setSwitchPending(true);
    try {
      await switchBrainModelAction({ threadId, connectionId, modelId });
      refreshWithTransition();
    } catch (error) {
      setOptimisticBrainModel(null);
      setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Brain model switch failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [threadId, switchBrainModelAction, refreshWithTransition, setSurfaceError]);

  const onTokensSwitch = useCallback(async (nextTokens: number) => {
    setOptimisticTokens(nextTokens);
    setSwitchPending(true);
    try {
      await switchTokensAction({ threadId, maxOutputTokens: nextTokens });
      refreshWithTransition();
    } catch (error) {
      setOptimisticTokens(null);
      setSurfaceError(error instanceof Error ? humanizeChatError(error.message) : "Tokens limit update failed.");
    } finally {
      setSwitchPending(false);
    }
  }, [threadId, switchTokensAction, refreshWithTransition, setSurfaceError]);

  return {
    switchPending,
    optimisticBranchId,
    optimisticPersonaId,
    optimisticModel,
    optimisticBrainModel,
    optimisticTokens,
    onBranchSwitch,
    onPersonaSwitch,
    onModelSwitch,
    onBrainModelSwitch,
    onTokensSwitch,
  };
}
