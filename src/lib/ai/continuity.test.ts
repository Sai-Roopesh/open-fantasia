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
        story_summary: "They met in the hotel bar before the room began to distort around them.",
        scene_summary: "They were circling around an unspoken tension.",
        last_turn_beat: "The lights flickered and neither of them admitted why.",
        relationship_state: "Guarded but curious.",
        user_facts: ["The user has just arrived."],
        active_threads: ["Why the room shifted"],
        resolved_threads: [],
        next_turn_pressure: ["Decide whether to trust the confession"],
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
    expect(snapshot.story_summary).toContain("They met in the hotel bar");
    expect(snapshot.scene_summary).toContain("USER:");
    expect(snapshot.last_turn_beat).toContain("I step closer");
    expect(snapshot.active_threads).toContain("Why the room shifted");
    expect(snapshot.next_turn_pressure).toContain("Decide whether to trust the confession");
  });
});
