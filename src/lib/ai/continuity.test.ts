import { describe, expect, it } from "vitest";
import { buildFallbackSnapshot } from "@/lib/ai/continuity";
import type { ChatTurnRecord } from "@/lib/types";
import { createTextMessage } from "@/lib/threads/read-model";

const baseTurn: ChatTurnRecord = {
  id: "turn-1",
  thread_id: "thread-1",
  branch_origin_id: "branch-1",
  parent_turn_id: null,
  user_input_text: "I step closer and ask what changed.",
  user_input_payload: [],
  user_input_hidden: false,
  starter_seed: false,
  assistant_output_text: "She admits the room shifted the moment you arrived.",
  assistant_output_payload: [],
  generation_status: "committed",
  reserved_by_user_id: "user-1",
  assistant_provider: "mistral",
  assistant_model: "mistral-medium-latest",
  assistant_connection_label: "Mistral API",
  finish_reason: "stop",
  total_tokens: 100,
  prompt_tokens: 60,
  completion_tokens: 40,
  feedback_rating: null,
  generation_started_at: "2026-04-18T12:00:00.000Z",
  generation_finished_at: "2026-04-18T12:00:05.000Z",
  failure_code: null,
  failure_message: null,
  created_at: "2026-04-18T12:00:00.000Z",
  updated_at: "2026-04-18T12:00:05.000Z",
};

describe("buildFallbackSnapshot", () => {
  it("builds a usable deterministic snapshot when reconciliation is unavailable", () => {
    const snapshot = buildFallbackSnapshot({
      turn: baseTurn,
      previousSnapshot: {
        turn_id: "turn-0",
        thread_id: "thread-1",
        branch_id: "branch-1",
        based_on_turn_id: null,
        scenario_state: "They were circling around an unspoken tension.",
        relationship_state: "Guarded but curious.",
        rolling_summary: "They met in the hotel bar.",
        user_facts: ["The user has just arrived."],
        open_loops: ["Why the room shifted"],
        resolved_loops: [],
        narrative_hooks: ["A confession is coming."],
        scene_goals: ["Get the truth out."],
        version: 1,
        updated_at: "2026-04-18T11:59:00.000Z",
      },
      recentMessages: [
        createTextMessage({ role: "user", text: baseTurn.user_input_text }),
        createTextMessage({
          role: "assistant",
          text: baseTurn.assistant_output_text ?? "",
        }),
      ],
    });

    expect(snapshot.turn_id).toBe(baseTurn.id);
    expect(snapshot.version).toBe(2);
    expect(snapshot.relationship_state).toBe("Guarded but curious.");
    expect(snapshot.rolling_summary).toContain("USER:");
    expect(snapshot.scenario_state).toContain("I step closer");
    expect(snapshot.open_loops).toContain("Why the room shifted");
  });
});
