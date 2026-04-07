import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { getTextFromMessage } from "@/lib/ai/message-text";
import { requireAllowedUser } from "@/lib/auth";
import { getCharacterBundle } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { listPersonas } from "@/lib/data/personas";
import { getThreadGraphView } from "@/lib/data/threads";
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
  const threadView = await getThreadGraphView(supabase, user.id, threadId);

  if (!threadView) {
    notFound();
  }
  const view = threadView;

  const [character, connections, personas] = await Promise.all([
    getCharacterBundle(supabase, user.id, view.thread.character_id),
    listConnections(supabase, user.id),
    listPersonas(supabase, user.id),
  ]);

  if (!character) {
    redirect("/app/characters");
  }

  const currentConnection =
    connections.find((connection) => connection.id === view.thread.connection_id) ??
    connections[0];
  const currentPersona =
    personas.find((persona) => persona.id === view.thread.persona_id) ?? null;
  const messageTextById = new Map(
    view.canonicalMessages.map((message) => [message.id, getTextFromMessage(message)]),
  );
  const parentBranch = view.branches.find(
    (branch) => branch.id === view.activeBranch.parent_branch_id,
  );
  const latestAssistantMessage = [...view.canonicalMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const alternateCount = latestAssistantMessage
    ? Math.max(
        (view.controlsByMessageId[latestAssistantMessage.id]?.alternates.length ?? 1) - 1,
        0,
      )
    : 0;
  const continuitySnapshot = view.headSnapshot;
  const continuityStatus = view.headSnapshotPending
    ? {
        tone: "pending" as const,
        title: "This branch head is missing its continuity snapshot",
        detail:
          "The active branch points at a turn without a committed continuity state. New turns should stay blocked until the thread is repaired or rebuilt.",
      }
    : null;

  const inspectorView: ContinuityInspectorView = {
    continuityStatus,
    continuity: [
      {
        label: "Scenario state",
        value:
          continuitySnapshot?.scenario_state ||
          "No scenario snapshot has been written for this branch yet.",
        helper:
          "This is the current framing of the scene that the next assistant turn receives.",
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
        label: "Rolling summary",
        value:
          continuitySnapshot?.rolling_summary ||
          "No rolling summary exists yet. Once the thread advances, the runtime will compress the recent scene here.",
        helper:
          "This is the short-form continuity buffer that keeps long chats coherent without replaying every turn.",
      },
      {
        label: "Open loops",
        value: continuitySnapshot?.open_loops?.length
          ? continuitySnapshot.open_loops.map((item) => `• ${item}`).join("\n")
          : "No unresolved loops are currently tracked on this branch.",
        helper:
          "Open loops are the unresolved promises, questions, or consequences the system believes still matter.",
      },
      {
        label: "Scene goals and user facts",
        value: [
          continuitySnapshot?.scene_goals?.length
            ? `Scene goals:\n${continuitySnapshot.scene_goals
                .map((goal) => `• ${goal}`)
                .join("\n")}`
            : null,
          continuitySnapshot?.user_facts?.length
            ? `User facts:\n${continuitySnapshot.user_facts
                .map((fact) => `• ${fact}`)
                .join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n") ||
          "No scene goals or durable user facts have been saved for this branch yet.",
        helper:
          "These are the durable facts and near-term objectives the runtime believes should influence the next beat.",
      },
    ],
    pins: view.pins.map((pin) => ({
      id: pin.id,
      body: pin.body,
      createdAt: pin.created_at,
      sourceLabel: pin.source_message_id ? "Pinned from transcript" : "Pinned manually",
      sourceExcerpt: pin.source_message_id
        ? truncateCopy(messageTextById.get(pin.source_message_id) ?? "Source message is no longer on this branch.", 120)
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
      forkCheckpointId: view.activeBranch.fork_checkpoint_id,
      headCheckpointId: view.activeBranch.head_checkpoint_id,
      totalBranches: view.branches.length,
      totalCheckpoints: view.checkpoints.length,
      alternateCount,
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
              {character.character.short_description ||
                character.character.scenario_seed ||
                character.character.core_persona ||
                character.character.greeting}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="rounded-[1.5rem] bg-white/5 px-5 py-4 text-sm text-ink-soft">
              <p className="text-xs uppercase tracking-[0.22em]">Current lane</p>
              <p className="mt-2 font-medium text-foreground">
                {currentConnection?.label ?? "No connection"}
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
        currentModel={view.thread.model_id}
        currentConnectionLabel={currentConnection?.label ?? "Unknown lane"}
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
