import { describe, it, expect } from "vitest";
import {
  chatStoreReducer,
  initChatStore,
  selectDisplayBranchId,
  selectDisplaySettings,
  type ChatStoreSeed,
} from "./chat-store";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  ThreadSettingsSlice,
  TurnSlicePatch,
} from "@/lib/types";

const branch = (id: string, headTurnId: string | null = null) =>
  ({ id, head_turn_id: headTurnId, name: id } as unknown as ChatBranchRecord);

const inspector = (): ContinuityInspectorView =>
  ({
    continuityStatus: null,
    continuity: [],
    pins: [],
    timeline: [],
    branch: {
      activeBranchId: "b1",
      activeBranchName: "b1",
      parentBranchName: null,
      forkTurnId: null,
      headTurnId: null,
      totalBranches: 1,
      totalTurns: 0,
    },
  }) satisfies ContinuityInspectorView;

const settings = (overrides: Partial<ThreadSettingsSlice> = {}): ThreadSettingsSlice => ({
  model: { connectionId: "c1", modelId: "m1", label: "Lane One" },
  personaId: "p1",
  brain: { connectionId: null, modelId: null },
  maxOutputTokens: 2048,
  ...overrides,
});

const seed = (): ChatStoreSeed => ({
  controlsByMessageId: {},
  inspectorView: inspector(),
  activeBranch: branch("b1", "turn1"),
  branches: [branch("b1", "turn1")],
  settings: settings(),
});

const slice = (overrides: Partial<TurnSlicePatch> = {}): TurnSlicePatch => ({
  headTurnId: "turn2",
  messages: [],
  controlsByMessageId: { "turn2:assistant": {} as never },
  activeBranch: branch("b1", "turn2"),
  branches: [branch("b1", "turn2")],
  inspectorView: inspector(),
  settings: settings({ personaId: "p2" }),
  ...overrides,
});

describe("chatStoreReducer", () => {
  it("seeds from the server snapshot with no optimistic/pending state", () => {
    const state = initChatStore(seed());
    expect(state.pendingAction).toBeNull();
    expect(state.switchPending).toBe(false);
    expect(state.optimisticSettings).toBeNull();
    expect(state.optimisticBranchId).toBeNull();
    expect(state.settings.personaId).toBe("p1");
  });

  it("applySlice replaces aux state and clears every optimistic/pending flag", () => {
    let state = initChatStore(seed());
    state = chatStoreReducer(state, { type: "mutationStart", label: "edit" });
    state = chatStoreReducer(state, {
      type: "switchStart",
      settings: { personaId: "p9" },
    });
    expect(state.pendingAction).toBe("edit");
    expect(state.optimisticSettings).not.toBeNull();

    const next = chatStoreReducer(state, { type: "applySlice", slice: slice() });
    expect(next.activeBranch.head_turn_id).toBe("turn2");
    expect(next.settings.personaId).toBe("p2");
    expect(next.controlsByMessageId["turn2:assistant"]).toBeDefined();
    expect(next.pendingAction).toBeNull();
    expect(next.switchPending).toBe(false);
    expect(next.optimisticSettings).toBeNull();
    expect(next.optimisticBranchId).toBeNull();
    expect(next.surfaceError).toBeNull();
  });

  it("switchStart sets the optimistic overlay and pending flag", () => {
    const state = chatStoreReducer(initChatStore(seed()), {
      type: "switchStart",
      branchId: "b2",
      settings: { maxOutputTokens: 8192 },
    });
    expect(state.switchPending).toBe(true);
    expect(state.optimisticBranchId).toBe("b2");
    expect(state.optimisticSettings).toEqual({ maxOutputTokens: 8192 });
  });

  it("switchError reverts the optimistic overlay and surfaces the error", () => {
    let state = chatStoreReducer(initChatStore(seed()), {
      type: "switchStart",
      settings: { personaId: "p9" },
    });
    state = chatStoreReducer(state, { type: "switchError", error: "nope" });
    expect(state.switchPending).toBe(false);
    expect(state.optimisticSettings).toBeNull();
    expect(state.surfaceError).toBe("nope");
  });

  it("mutationError clears pending and surfaces the error", () => {
    let state = chatStoreReducer(initChatStore(seed()), {
      type: "mutationStart",
      label: "rewind",
    });
    state = chatStoreReducer(state, { type: "mutationError", error: "boom" });
    expect(state.pendingAction).toBeNull();
    expect(state.surfaceError).toBe("boom");
  });
});

describe("selectDisplaySettings", () => {
  it("returns authoritative settings when there is no overlay", () => {
    const state = initChatStore(seed());
    expect(selectDisplaySettings(state)).toEqual(state.settings);
  });

  it("merges optimistic overlay over authoritative settings, including nested model/brain", () => {
    const state = chatStoreReducer(initChatStore(seed()), {
      type: "switchStart",
      settings: { model: { connectionId: "c2", modelId: "m2", label: "Lane Two" } },
    });
    const display = selectDisplaySettings(state);
    expect(display.model).toEqual({ connectionId: "c2", modelId: "m2", label: "Lane Two" });
    // unrelated fields stay authoritative
    expect(display.personaId).toBe("p1");
    expect(display.maxOutputTokens).toBe(2048);
  });
});

describe("selectDisplayBranchId", () => {
  it("prefers the optimistic branch id, falling back to the active branch", () => {
    const base = initChatStore(seed());
    expect(selectDisplayBranchId(base)).toBe("b1");
    const optimistic = chatStoreReducer(base, { type: "switchStart", branchId: "b2" });
    expect(selectDisplayBranchId(optimistic)).toBe("b2");
  });
});
