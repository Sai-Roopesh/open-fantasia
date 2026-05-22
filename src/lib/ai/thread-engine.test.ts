import { describe, expect, it } from "vitest";
import { buildSnapshotFromReconciliation } from "@/lib/ai/thread-engine";

describe("buildSnapshotFromReconciliation", () => {
  it("maps the hybrid memory fields and enforces output caps", () => {
    const snapshot = buildSnapshotFromReconciliation({
      turnId: "turn-2",
      threadId: "thread-1",
      branchId: "branch-1",
      previousSnapshot: {
        turn_id: "turn-1",
        thread_id: "thread-1",
        branch_id: "branch-1",
        based_on_turn_id: null,
        story_summary: "Old story summary.",
        scene_summary: "Old scene summary.",
        last_turn_beat: "Old beat.",
        relationship_state: "Old relationship.",
        user_facts: [],
        active_threads: [],
        resolved_threads: [],
        next_turn_pressure: [],
        scene_goals: [],
        version: 1,
        updated_at: "2026-04-23T00:00:00.000Z",
      },
      reconciliation: {
        storySummary:
          "One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten. Eleven. Twelve. Thirteen.",
        sceneSummary:
          "Scene one. Scene two. Scene three. Scene four. Scene five. Scene six.",
        lastTurnBeat: "Beat one. Beat two. Beat three.",
        relationshipState: "Rel one. Rel two. Rel three. Rel four.",
        userFacts: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
        activeThreads: ["1", "2", "3", "4", "5", "6"],
        resolvedThreads: ["1", "2", "3", "4", "5", "6"],
        nextTurnPressure: ["1", "2", "3", "4"],
        sceneGoals: ["1", "2", "3", "4", "5", "6"],
        timelineEvent: {
          title: "A beat landed",
          detail: "Something changed",
          importance: 3,
        },
      },
    });

    expect(snapshot.version).toBe(2);
    expect(snapshot.story_summary).toContain("Twelve.");
    expect(snapshot.story_summary).not.toContain("Thirteen.");
    expect(snapshot.scene_summary).toContain("Scene five.");
    expect(snapshot.scene_summary).not.toContain("Scene six.");
    expect(snapshot.last_turn_beat).toContain("Beat two.");
    expect(snapshot.last_turn_beat).not.toContain("Beat three.");
    expect(snapshot.relationship_state).toContain("Rel three.");
    expect(snapshot.relationship_state).not.toContain("Rel four.");
    expect(snapshot.user_facts).toHaveLength(8);
    expect(snapshot.active_threads).toHaveLength(5);
    expect(snapshot.resolved_threads).toHaveLength(5);
    expect(snapshot.next_turn_pressure).toHaveLength(3);
    expect(snapshot.scene_goals).toHaveLength(5);
  });
});
