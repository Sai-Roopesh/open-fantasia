import { convertToModelMessages, generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { reconcileTurnState, buildSnapshotFromReconciliation } from "@/lib/ai/thread-engine";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import {
  createCheckpoint,
  createTextMessage,
  getSnapshot,
  getThreadGraphView,
  insertTimelineEvent,
  persistMessage,
  saveSnapshot,
  selectCheckpointAsBranchHead,
} from "@/lib/data/threads";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";

type RegenerateRequest = {
  checkpointId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const body = (await request.json()) as RegenerateRequest;
  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView || !threadView.latestCheckpoint) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const [character, connection, persona] = await Promise.all([
    getCharacterBundle(context.supabase, context.user.id, threadView.thread.character_id),
    getConnection(context.supabase, context.user.id, threadView.thread.connection_id),
    threadView.thread.persona_id
      ? getPersona(context.supabase, context.user.id, threadView.thread.persona_id)
      : Promise.resolve(null),
  ]);

  if (!character || !connection || !persona) {
    return Response.json({ error: "Missing thread context." }, { status: 400 });
  }

  const latestCheckpoint = threadView.latestCheckpoint;
  if (body.checkpointId && body.checkpointId !== latestCheckpoint.id) {
    return Response.json(
      { error: "Only the latest assistant checkpoint can be regenerated." },
      { status: 400 },
    );
  }

  const contextMessages = threadView.canonicalMessages.slice(0, -1);

  const result = await generateText({
    model: createLanguageModel(connection, threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character,
      persona,
      snapshot: threadView.headSnapshot,
      pins: threadView.pins,
      timeline: [...threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages(contextMessages),
    temperature: 0.92,
    topP: 0.94,
    maxOutputTokens: 750,
  });

  const assistantMessage = createTextMessage({
    role: "assistant",
    text: result.text,
    metadata: {
      provider: connection.provider,
      model: threadView.thread.model_id,
      connectionLabel: connection.label,
      branchId: threadView.activeBranch.id,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
    },
  });

  const storedAssistant = await persistMessage(context.supabase, threadId, assistantMessage);
  const checkpoint = await createCheckpoint(context.supabase, {
    thread_id: threadId,
    branch_id: threadView.activeBranch.id,
    parent_checkpoint_id: latestCheckpoint.parent_checkpoint_id,
    user_message_id: latestCheckpoint.user_message_id,
    assistant_message_id: storedAssistant.id,
    choice_group_key: latestCheckpoint.choice_group_key,
    feedback_rating: null,
    created_by: context.user.id,
  });

  await selectCheckpointAsBranchHead(context.supabase, threadView.activeBranch.id, checkpoint.id);

  const nextMessages = [...contextMessages, assistantMessage];
  const previousCheckpointSnapshot = latestCheckpoint.parent_checkpoint_id
    ? await getSnapshot(context.supabase, latestCheckpoint.parent_checkpoint_id)
    : null;

  const reconciliation = await reconcileTurnState({
    connection,
    modelId: threadView.thread.model_id,
    character,
    previousSnapshot: previousCheckpointSnapshot,
    recentMessages: nextMessages.slice(-16),
  });

  await saveSnapshot(
    context.supabase,
    buildSnapshotFromReconciliation({
      checkpointId: checkpoint.id,
      threadId,
      branchId: threadView.activeBranch.id,
      previousSnapshot: previousCheckpointSnapshot,
      reconciliation,
    }),
  );

  if (reconciliation.timelineEvent) {
    await insertTimelineEvent(context.supabase, {
      thread_id: threadId,
      branch_id: threadView.activeBranch.id,
      checkpoint_id: checkpoint.id,
      source_message_id: storedAssistant.id,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }

  return Response.json({ ok: true, checkpointId: checkpoint.id });
}
