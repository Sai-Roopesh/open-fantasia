import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  ThreadSettingsSlice,
  TranscriptControl,
  TurnSlicePatch,
} from "@/lib/types";

/**
 * Client-side source of truth for the chat workspace's *auxiliary* reconcilable
 * state — everything except the transcript messages themselves, which live in the
 * AI SDK `Chat` instance (the streaming substrate).
 *
 * Every mutation returns an authoritative {@link TurnSlicePatch}; applying it here
 * (plus `chat.setMessages` for message-changing mutations) updates the UI instantly
 * without a blind `router.refresh()`. Settings switches additionally carry an
 * optimistic overlay so selectors reflect the choice immediately and reconcile to
 * the authoritative value when the slice lands — no timer-based reset race.
 */
export type ChatStoreState = {
  controlsByMessageId: Record<string, TranscriptControl>;
  inspectorView: ContinuityInspectorView;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  settings: ThreadSettingsSlice;
  /** Optimistic branch selection shown until the slice confirms it. */
  optimisticBranchId: string | null;
  /** Optimistic settings overlay shown until the slice confirms it. */
  optimisticSettings: Partial<ThreadSettingsSlice> | null;
  /** Label of an in-flight transcript mutation (regenerate/rewind/edit/...). */
  pendingAction: string | null;
  /** True while a settings or branch switch is in flight. */
  switchPending: boolean;
  surfaceError: string | null;
  /** Draft text preserved when a send fails, offered back to the composer. */
  failedDraft: string | null;
};

export type ChatStoreSeed = {
  controlsByMessageId: Record<string, TranscriptControl>;
  inspectorView: ContinuityInspectorView;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  settings: ThreadSettingsSlice;
};

export type ChatStoreAction =
  | { type: "applySlice"; slice: TurnSlicePatch }
  | { type: "mutationStart"; label: string }
  | { type: "mutationError"; error: string }
  | {
      type: "switchStart";
      branchId?: string;
      settings?: Partial<ThreadSettingsSlice>;
    }
  | { type: "switchError"; error: string }
  | { type: "setError"; error: string | null }
  | { type: "setFailedDraft"; draft: string | null }
  | { type: "clearPending" };

export function initChatStore(seed: ChatStoreSeed): ChatStoreState {
  return {
    controlsByMessageId: seed.controlsByMessageId,
    inspectorView: seed.inspectorView,
    activeBranch: seed.activeBranch,
    branches: seed.branches,
    settings: seed.settings,
    optimisticBranchId: null,
    optimisticSettings: null,
    pendingAction: null,
    switchPending: false,
    surfaceError: null,
    failedDraft: null,
  };
}

export function chatStoreReducer(
  state: ChatStoreState,
  action: ChatStoreAction,
): ChatStoreState {
  switch (action.type) {
    case "applySlice":
      // Authoritative reconcile: wholesale replace of the reconcilable region.
      // Clears every optimistic/pending flag so the UI settles on server truth.
      return {
        ...state,
        controlsByMessageId: action.slice.controlsByMessageId,
        inspectorView: action.slice.inspectorView,
        activeBranch: action.slice.activeBranch,
        branches: action.slice.branches,
        settings: action.slice.settings,
        optimisticBranchId: null,
        optimisticSettings: null,
        pendingAction: null,
        switchPending: false,
        surfaceError: null,
      };
    case "mutationStart":
      return {
        ...state,
        pendingAction: action.label,
        surfaceError: null,
        failedDraft: null,
      };
    case "mutationError":
      return {
        ...state,
        pendingAction: null,
        switchPending: false,
        optimisticBranchId: null,
        optimisticSettings: null,
        surfaceError: action.error,
      };
    case "switchStart":
      return {
        ...state,
        switchPending: true,
        surfaceError: null,
        optimisticBranchId: action.branchId ?? state.optimisticBranchId,
        optimisticSettings: action.settings
          ? { ...(state.optimisticSettings ?? {}), ...action.settings }
          : state.optimisticSettings,
      };
    case "switchError":
      return {
        ...state,
        switchPending: false,
        optimisticBranchId: null,
        optimisticSettings: null,
        surfaceError: action.error,
      };
    case "setError":
      return { ...state, surfaceError: action.error };
    case "setFailedDraft":
      return { ...state, failedDraft: action.draft };
    case "clearPending":
      return { ...state, pendingAction: null };
    default:
      return state;
  }
}

/** Settings with the optimistic overlay merged on top (for instant selectors). */
export function selectDisplaySettings(state: ChatStoreState): ThreadSettingsSlice {
  const overlay = state.optimisticSettings;
  if (!overlay) {
    return state.settings;
  }
  return {
    ...state.settings,
    ...overlay,
    model: { ...state.settings.model, ...(overlay.model ?? {}) },
    brain: { ...state.settings.brain, ...(overlay.brain ?? {}) },
  };
}

/** Active branch id with the optimistic overlay applied. */
export function selectDisplayBranchId(state: ChatStoreState): string {
  return state.optimisticBranchId ?? state.activeBranch.id;
}
