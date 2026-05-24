import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { resolveCharacterPortraitUrl } from "@/lib/characters/portraits";
import { requireAllowedUser } from "@/lib/auth";
import { listConnections } from "@/lib/data/connections";
import { listPersonas } from "@/lib/data/personas";
import { getThreadGraphView } from "@/lib/threads/read-model";
import type { ContinuityInspectorView } from "@/lib/types";
import {
  switchThreadBranchAction,
  switchThreadModelAction,
  switchThreadPersonaAction,
} from "@/app/(app)/app/chats/[threadId]/actions";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { supabase, user } = await requireAllowedUser();

  const threadViewPromise = getThreadGraphView(supabase, user.id, threadId);
  const connectionsPromise = listConnections(supabase, user.id);
  const personasPromise = listPersonas(supabase, user.id);
  const [threadView, connections, personas] = await Promise.all([
    threadViewPromise,
    connectionsPromise,
    personasPromise,
  ]);

  if (!threadView) {
    notFound();
  }
  const view = threadView;
  const character = view.characterBundle;

  if (!character) {
    redirect("/app/characters");
  }
  if (!view.thread.persona_id) {
    redirect("/app/personas?reason=default");
  }
  const characterBackgroundUrl = resolveCharacterPortraitUrl(
    supabase,
    character.character.portrait_path,
  );

  const currentConnection = connections.find(
    (connection) => connection.id === view.thread.connection_id,
  );
  if (!currentConnection) {
    redirect("/app/settings/providers?reason=connection");
  }

  const currentPersona = personas.find(
    (persona) => persona.id === view.thread.persona_id,
  );
  if (!currentPersona) {
    redirect("/app/personas?reason=default");
  }

  const turnExcerptById = new Map(
    view.turns.map((turn) => {
      const transcript = [turn.user_input_text, turn.assistant_output_text ?? ""]
        .filter(Boolean)
        .join("\n");
      return [turn.id, transcript];
    }),
  );
  const parentBranch = view.branches.find(
    (branch) => branch.id === view.activeBranch.parent_branch_id,
  );
  const continuitySnapshot = view.headSnapshot;
  const continuityStatus = view.headSnapshotFailed
    ? {
        tone: "error" as const,
        title: "Continuity reconciliation failed",
        detail:
          view.headSnapshotFailureMessage ??
          "The active branch could not reconcile its latest turn. New turns stay blocked until you rewrite, regenerate, or rewind to a surviving turn.",
      }
    : view.headSnapshotPending
      ? {
          tone: "pending" as const,
          title: "Continuity reconciliation is still running",
          detail:
            "The latest turn has not produced a committed head snapshot yet. New turns stay blocked until reconciliation finishes.",
        }
      : null;

  const inspectorView: ContinuityInspectorView = {
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
              .map((e) => `• ${e.canonical_name} (${e.entity_type}) — ${e.primary_emotion} [${e.emotion_intensity}/10]`)
              .join("\n")
          : "No entities are currently tracked.",
        helper:
          "All characters, NPCs, creatures, and objects the engine is tracking, with their current emotional state.",
      },
      {
        label: "Relationships",
        value: continuitySnapshot?.relational_state.length
          ? continuitySnapshot.relational_state
              .map((r) => `• ${r.source_entity_name} → ${r.target_entity_name}: ${r.dynamic_status} (${r.relationship_type})`)
              .join("\n")
          : "No relationships are currently tracked.",
        helper:
          "Active relationships between entities with their current dynamic status.",
      },
      {
        label: "Current location",
        value: continuitySnapshot?.spatial_state.current_location
          ? `${continuitySnapshot.spatial_state.current_location.name}: ${continuitySnapshot.spatial_state.current_location.description}`
          : "No current location is set.",
        helper:
          "The user entity's current location in the world graph.",
      },
      {
        label: "Active threads",
        value:
          continuitySnapshot?.narrative_state.active_threads?.length
            ? continuitySnapshot.narrative_state.active_threads.map((t) => `• [${t.status}] ${t.objective}`).join("\n")
            : "No active threads are currently tracked on this branch.",
        helper:
          "These are the unresolved plot threads that are still alive and should be available to pull the next beat forward.",
      },
      {
        label: "Resolved threads",
        value: continuitySnapshot?.narrative_state.resolved_threads?.length
          ? continuitySnapshot.narrative_state.resolved_threads.map((item) => `• ${item}`).join("\n")
          : "No resolved threads are currently tracked yet.",
        helper:
          "Resolved threads are closed beats the runtime remembers as settled, so the assistant does not keep reopening them.",
      },
    ],
    pins: view.pins.map((pin) => ({
      id: pin.id,
      body: pin.body,
      createdAt: pin.created_at,
      sourceLabel: pin.turn_id ? "Pinned from transcript" : "Pinned manually",
      sourceExcerpt: pin.turn_id
        ? truncateCopy(turnExcerptById.get(pin.turn_id) ?? "Source turn is no longer on this branch.", 120)
        : "This pin was saved without a direct source message.",
    })),
    timeline: view.timeline.map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.detail,
      importance: event.importance,
      createdAt: event.created_at,
    })),
    branch: {
      activeBranchId: view.activeBranch.id,
      activeBranchName: view.activeBranch.name,
      parentBranchName: parentBranch?.name ?? null,
      forkTurnId: view.activeBranch.fork_turn_id,
      headTurnId: view.activeBranch.head_turn_id,
      totalBranches: view.branches.length,
      totalTurns: view.turns.length,
    },
  };

  return (
    <ChatWorkspace
      threadId={view.thread.id}
      characterName={character.character.name}
      characterBackgroundUrl={characterBackgroundUrl}
      currentModel={view.thread.model_id}
      currentConnectionLabel={currentConnection.label}
      activeBranch={view.activeBranch}
      branches={view.branches}
      currentPersona={currentPersona}
      personas={personas}
      initialMessages={view.canonicalMessages}
      controlsByMessageId={view.controlsByMessageId}
      suggestedStarters={character.starters.map((starter) => starter.text)}
      modelChoices={connections
        .filter((connection) => connection.enabled && connection.model_cache.length > 0)
        .map((connection) => ({
          connectionId: connection.id,
          label: connection.label,
          provider: connection.provider,
          models: connection.model_cache,
        }))}
      inspectorView={inspectorView}
      switchModelAction={switchThreadModelAction}
      switchBranchAction={switchThreadBranchAction}
      switchPersonaAction={switchThreadPersonaAction}
    />
  );
}

function truncateCopy(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}...`;
}
