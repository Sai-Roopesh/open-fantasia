import { describe, expect, it } from "vitest";
import { buildControlsByMessageId } from "@/lib/threads/read-model";
import type { ChatTurnRecord } from "@/lib/types";

function makeTurn(
  args: Partial<ChatTurnRecord> & Pick<ChatTurnRecord, "id" | "branch_origin_id">,
) {
  const { id, branch_origin_id, ...rest } = args;

  return {
    ...rest,
    id,
    thread_id: "thread-1",
    branch_origin_id,
    parent_turn_id: rest.parent_turn_id ?? null,
    user_input_text: rest.user_input_text ?? "User turn",
    user_input_payload: [],
    user_input_hidden: rest.user_input_hidden ?? false,
    starter_seed: rest.starter_seed ?? false,
    assistant_output_text: rest.assistant_output_text ?? "Assistant turn",
    assistant_output_payload: [],
    generation_status: rest.generation_status ?? "committed",
    reserved_by_user_id: "user-1",
    assistant_provider: null,
    assistant_model: null,
    assistant_connection_label: null,
    finish_reason: null,
    total_tokens: null,
    prompt_tokens: null,
    completion_tokens: null,
    feedback_rating: null,
    generation_started_at: "2026-04-22T00:00:00.000Z",
    generation_finished_at: "2026-04-22T00:00:01.000Z",
    failure_code: null,
    failure_message: null,
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:01.000Z",
  } satisfies ChatTurnRecord;
}

describe("buildControlsByMessageId", () => {
  it("allows editing the latest assistant reply while preserving regenerate", () => {
    const firstTurn = makeTurn({
      id: "turn-1",
      branch_origin_id: "branch-1",
    });
    const latestTurn = makeTurn({
      id: "turn-2",
      branch_origin_id: "branch-1",
      parent_turn_id: "turn-1",
    });

    const controls = buildControlsByMessageId([firstTurn, latestTurn]);

    expect(controls["turn-1:assistant"]).toMatchObject({
      canEdit: false,
      canRegenerate: false,
    });
    expect(controls["turn-2:user"]).toMatchObject({
      canEdit: true,
      canRegenerate: false,
    });
    expect(controls["turn-2:assistant"]).toMatchObject({
      canEdit: true,
      canRegenerate: true,
    });
  });
});
