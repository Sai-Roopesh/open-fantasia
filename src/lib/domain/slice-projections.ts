import type {
  ConnectionRecord,
  ContinuityInspectorView,
  SnapshotResolution,
  ThreadSettingsSlice,
  TurnSlicePatch,
} from "@/lib/types";
import type { ThreadAssembly } from "./thread-assembly";
import { buildBranchTree } from "./branch-tree";
import {
  buildCanonicalMessages,
  buildControlsByMessageId,
} from "./turn-projections";

function truncateCopy(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}...`;
}

export function buildInspectorView(
  assembly: ThreadAssembly,
  snapshot: SnapshotResolution,
): ContinuityInspectorView {
  const turnExcerptById = new Map(
    assembly.turns.map((turn) => {
      const transcript = [turn.user_input_text, turn.assistant_output_text ?? ""]
        .filter(Boolean)
        .join("\n");
      return [turn.id, transcript];
    }),
  );
  const parentBranch = assembly.branches.find(
    (branch) => branch.id === assembly.activeBranch.parent_branch_id,
  );
  const continuitySnapshot = snapshot.snapshot;
  const continuityStatus = snapshot.isFailed
    ? {
        tone: "error" as const,
        title: "Continuity reconciliation failed",
        detail:
          snapshot.failureMessage ??
          "The active branch could not reconcile its latest turn. New turns stay blocked until you rewrite, regenerate, or rewind to a surviving turn.",
      }
    : snapshot.isPending
      ? {
          tone: "pending" as const,
          title: "Continuity reconciliation is still running",
          detail:
            "The latest turn has not produced a committed head snapshot yet. New turns stay blocked until reconciliation finishes.",
        }
      : null;

  return {
    continuityStatus,
    continuity: [
      {
        label: "Story summary",
        value:
          continuitySnapshot?.narrative_state.story_summary ||
          "No durable story summary has been written for this branch yet.",
        helper:
          "This is the whole-branch memory summary the next assistant turn receives as durable context.",
      },
      {
        label: "Current scene",
        value:
          continuitySnapshot?.narrative_state.scene_summary ||
          "No current-scene summary has been written for this branch yet.",
        helper:
          "This is the short scene-local memory that keeps the immediate situation sharp without replaying the whole chat.",
      },
      {
        label: "Last beat",
        value:
          continuitySnapshot?.narrative_state.last_turn_beat ||
          "No latest beat has been written for this branch yet.",
        helper:
          "This captures how the newest exchange changed the scene, so the next reply can build forward instead of repeating itself.",
      },
      {
        label: "Entities",
        value: continuitySnapshot?.entity_state.length
          ? continuitySnapshot.entity_state
              .map(
                (e) =>
                  `• ${e.canonical_name} (${e.entity_type}) — ${e.primary_emotion} [${e.emotion_intensity}/10]`,
              )
              .join("\n")
          : "No entities are currently tracked.",
        helper:
          "All characters, NPCs, creatures, and objects the engine is tracking, with their current emotional state.",
      },
      {
        label: "Relationships",
        value: continuitySnapshot?.relational_state.length
          ? continuitySnapshot.relational_state
              .map(
                (r) =>
                  `• ${r.source_entity_name} → ${r.target_entity_name}: ${r.dynamic_status} (${r.relationship_type})`,
              )
              .join("\n")
          : "No relationships are currently tracked.",
        helper: "Active relationships between entities with their current dynamic status.",
      },
      {
        label: "Current location",
        value: continuitySnapshot?.spatial_state.current_location
          ? `${continuitySnapshot.spatial_state.current_location.name}: ${continuitySnapshot.spatial_state.current_location.description}`
          : "No current location is set.",
        helper: "The user entity's current location in the world graph.",
      },
      {
        label: "Active threads",
        value: continuitySnapshot?.narrative_state.active_threads?.length
          ? continuitySnapshot.narrative_state.active_threads
              .map((t) => `• [${t.status}] ${t.objective}`)
              .join("\n")
          : "No active threads are currently tracked on this branch.",
        helper:
          "These are the unresolved plot threads that are still alive and should be available to pull the next beat forward.",
      },
      {
        label: "Resolved threads",
        value: continuitySnapshot?.narrative_state.resolved_threads?.length
          ? continuitySnapshot.narrative_state.resolved_threads
              .map((item) => `• ${item}`)
              .join("\n")
          : "No resolved threads are currently tracked yet.",
        helper:
          "Resolved threads are closed beats the runtime remembers as settled, so the assistant does not keep reopening them.",
      },
    ],
    pins: assembly.pins.map((pin) => ({
      id: pin.id,
      body: pin.body,
      createdAt: pin.created_at,
      sourceLabel: pin.turn_id ? "Pinned from transcript" : "Pinned manually",
      sourceExcerpt: pin.turn_id
        ? truncateCopy(
            turnExcerptById.get(pin.turn_id) ??
              "Source turn is no longer on this branch.",
            120,
          )
        : "This pin was saved without a direct source message.",
    })),
    timeline: assembly.timeline.map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.detail,
      importance: event.importance,
      createdAt: event.created_at,
    })),
    branch: {
      activeBranchId: assembly.activeBranch.id,
      activeBranchName: assembly.activeBranch.name,
      parentBranchName: parentBranch?.name ?? null,
      forkTurnId: assembly.activeBranch.fork_turn_id,
      headTurnId: assembly.activeBranch.head_turn_id,
      totalBranches: assembly.branches.length,
      totalTurns: assembly.turns.length,
    },
  };
}

export function buildThreadSettingsSlice(
  assembly: ThreadAssembly,
  connections: ConnectionRecord[],
): ThreadSettingsSlice {
  const connection = connections.find((c) => c.id === assembly.thread.connection_id);
  return {
    model: {
      connectionId: assembly.thread.connection_id,
      modelId: assembly.thread.model_id,
      label: connection?.label ?? "",
    },
    personaId: assembly.thread.persona_id ?? "",
    brain: {
      connectionId: assembly.thread.brain_connection_id,
      modelId: assembly.thread.brain_model_id,
    },
    maxOutputTokens: assembly.thread.max_output_tokens,
    directorNotes: assembly.thread.director_notes,
  };
}

export function buildTurnSlicePatch(
  assembly: ThreadAssembly,
  snapshot: SnapshotResolution,
  connections: ConnectionRecord[],
): TurnSlicePatch {
  return {
    headTurnId: assembly.activeBranch.head_turn_id,
    messages: buildCanonicalMessages(assembly.turns),
    controlsByMessageId: buildControlsByMessageId(assembly.turns),
    activeBranch: assembly.activeBranch,
    branches: assembly.branches,
    branchTree: buildBranchTree(assembly.branches),
    inspectorView: buildInspectorView(assembly, snapshot),
    settings: buildThreadSettingsSlice(assembly, connections),
  };
}
