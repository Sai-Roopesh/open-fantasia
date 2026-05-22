import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { resolveCharacterPortraitUrl } from "@/lib/characters/portraits";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { requireAllowedUser } from "@/lib/auth";
import { listConnections } from "@/lib/data/connections";
import { listPersonas } from "@/lib/data/personas";
import { getThreadGraphView } from "@/lib/threads/read-model";
import type { ContinuityInspectorView } from "@/lib/types";
import {
  deleteThreadAction,
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
          continuitySnapshot?.story_summary ||
          "No durable story summary has been written for this branch yet.",
        helper:
          "This is the whole-branch memory summary the next assistant turn receives as durable context.",
      },
      {
        label: "Current scene",
        value:
          continuitySnapshot?.scene_summary ||
          "No current-scene summary has been written for this branch yet.",
        helper:
          "This is the short scene-local memory that keeps the immediate situation sharp without replaying the whole chat.",
      },
      {
        label: "Last beat",
        value:
          continuitySnapshot?.last_turn_beat ||
          "No latest beat has been written for this branch yet.",
        helper:
          "This captures how the newest exchange changed the scene, so the next reply can build forward instead of repeating itself.",
      },
      {
        label: "Relationship state",
        value:
          continuitySnapshot?.relationship_state ||
          "No relationship state is locked in for this branch yet.",
        helper:
          "Use this to understand the emotional distance, trust, tension, or intimacy being carried forward.",
      },
      {
        label: "Active threads",
        value:
          continuitySnapshot?.active_threads?.length
            ? continuitySnapshot.active_threads.map((item) => `• ${item}`).join("\n")
            : "No active threads are currently tracked on this branch.",
        helper:
          "These are the unresolved threads that are still alive and should be available to pull the next beat forward.",
      },
      {
        label: "Resolved threads",
        value: continuitySnapshot?.resolved_threads?.length
          ? continuitySnapshot.resolved_threads.map((item) => `• ${item}`).join("\n")
          : "No resolved threads are currently tracked yet.",
        helper:
          "Resolved threads are closed beats the runtime remembers as settled, so the assistant does not keep reopening them.",
      },
      {
        label: "Next pressure",
        value: continuitySnapshot?.next_turn_pressure?.length
          ? continuitySnapshot.next_turn_pressure.map((item) => `• ${item}`).join("\n")
          : "No immediate next-turn pressure is currently tracked.",
        helper:
          "These are the concrete pressures, opportunities, or risks that should help the next assistant turn move the plot instead of recap it.",
      },
      {
        label: "Scene goals",
        value: continuitySnapshot?.scene_goals?.length
          ? continuitySnapshot.scene_goals.map((goal) => `• ${goal}`).join("\n")
          : "No near-term scene goals are currently tracked.",
        helper:
          "Scene goals are near-term objectives grounded in the current moment rather than the whole branch history.",
      },
      {
        label: "User facts",
        value: continuitySnapshot?.user_facts?.length
          ? continuitySnapshot.user_facts.map((fact) => `• ${fact}`).join("\n")
          : "No durable user facts have been saved for this branch yet.",
        helper:
          "These are the durable user facts the runtime thinks still matter beyond the current scene.",
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
    <div className="space-y-6">
      <section className="paper-panel rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">
          Active thread
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-5xl text-foreground">
              {character.character.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">
              {character.character.story ||
                character.character.core_persona ||
                character.character.greeting}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="rounded-[1.5rem] bg-white/5 px-5 py-4 text-sm text-ink-soft">
              <p className="text-xs uppercase tracking-[0.22em]">Current lane</p>
              <p className="mt-2 font-medium text-foreground">
                {currentConnection.label}
              </p>
              <p className="mt-1">{threadView.thread.model_id}</p>
            </div>

            <form action={deleteThreadAction}>
              <input type="hidden" name="threadId" value={threadView.thread.id} />
              <ConfirmSubmitButton
                confirmMessage="Delete this thread and all of its branches, messages, snapshots, and pins?"
                className="border border-red-900/40 bg-red-950/40 text-red-400 hover:bg-red-900/50"
              >
                Delete thread
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      </section>

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
    </div>
  );
}

function truncateCopy(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}...`;
}
