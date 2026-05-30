import { describe, expect, it } from "vitest";
import {
  assertBranchReadyForNewTurn,
  assertBranchReadyForRewrite,
  assertLatestTurnRewriteTarget,
  buildGenerationMessages,
  ThreadGenerationServiceError,
} from "@/lib/ai/generation-helpers";
import { buildRecentSceneMessages } from "@/lib/domain/turn-projections";
import type { ChatBranchRecord, ChatTurnRecord } from "@/lib/types";

function makeBranch(overrides: Partial<ChatBranchRecord> = {}): ChatBranchRecord {
  return {
    id: "branch-1",
    thread_id: "thread-1",
    name: "Main",
    parent_branch_id: null,
    fork_turn_id: null,
    head_turn_id: "turn-1",
    is_active: true,
    generation_locked: false,
    locked_by_turn_id: null,
    locked_at: null,
    created_by: "user-1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeTurn(id: string): ChatTurnRecord {
  return {
    id,
    thread_id: "thread-1",
    branch_origin_id: "branch-1",
    parent_turn_id: null,
    user_input_text: `user ${id}`,
    user_input_payload: [],
    user_input_hidden: false,
    starter_seed: false,
    assistant_output_text: `assistant ${id}`,
    assistant_output_payload: [],
    generation_status: "committed",
    reserved_by_user_id: "user-1",
    assistant_provider: null,
    assistant_model: null,
    assistant_connection_label: null,
    finish_reason: null,
    total_tokens: null,
    prompt_tokens: null,
    completion_tokens: null,
    feedback_rating: null,
    generation_started_at: "",
    generation_finished_at: "",
    failure_code: null,
    failure_message: null,
    created_at: "",
    updated_at: "",
  };
}

describe("thread generation guards", () => {
  it("allows a new turn even if the head snapshot is missing", () => {
    expect(() => assertBranchReadyForNewTurn(makeBranch())).not.toThrow();
  });

  it("allows regenerate/edit even if the head snapshot is missing", () => {
    expect(() => assertBranchReadyForRewrite(makeBranch())).not.toThrow();
  });

  it("requires rewriting against the active branch head", () => {
    const latestTurn = assertLatestTurnRewriteTarget({
      activeBranch: makeBranch(),
      latestTurn: makeTurn("turn-1"),
      branchId: "branch-1",
      expectedHeadTurnId: "turn-1",
    });

    expect(latestTurn.id).toBe("turn-1");
  });

  it("blocks rewrite requests when the active branch changed", () => {
    expect(() =>
      assertLatestTurnRewriteTarget({
        activeBranch: makeBranch(),
        latestTurn: makeTurn("turn-1"),
        branchId: "branch-2",
        expectedHeadTurnId: "turn-1",
      }),
    ).toThrow(ThreadGenerationServiceError);
  });

  it("still blocks when the branch is generation-locked", () => {
    expect(() =>
      assertBranchReadyForNewTurn(makeBranch({ generation_locked: true })),
    ).toThrow(ThreadGenerationServiceError);
  });

  it("builds generation context from only the last four committed turns", () => {
    const messages = buildGenerationMessages({
      recentSceneMessages: buildRecentSceneMessages([
        makeTurn("turn-1"),
        makeTurn("turn-2"),
        makeTurn("turn-3"),
        makeTurn("turn-4"),
        makeTurn("turn-5"),
      ]),
    });

    expect(messages).toHaveLength(8);
    expect(messages[0]?.id).toBe("turn-2:user");
    expect(messages.at(-1)?.id).toBe("turn-5:assistant");
  });
});
