import { convertToModelMessages, generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { reconcileTurnState, buildSnapshotFromReconciliation } from "@/lib/ai/thread-engine";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import {
  createBranch,
  createCheckpoint,
  createTextMessage,
  getSnapshot,
  getThreadGraphView,
  insertTimelineEvent,
  persistMessage,
  saveSnapshot,
  switchActiveBranch,
  updateBranchHead,
  updateThreadTitle,
} from "@/lib/data/threads";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";

type EditRequest = {
  content?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, messageId } = await params;
  const body = (await request.json()) as EditRequest;
  const nextContent = body.content?.trim();
  if (!nextContent) {
    return Response.json({ error: "Edited content is required." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView || !threadView.latestCheckpoint) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (threadView.latestCheckpoint.user_message_id !== messageId) {
    return Response.json(
      { error: "Only the latest user message can be edited in this build." },
      { status: 400 },
    );
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
  const parentCheckpointId = latestCheckpoint.parent_checkpoint_id;
  const priorSnapshot = parentCheckpointId
    ? await getSnapshot(context.supabase, parentCheckpointId)
    : null;
  const branch = await createBranch(context.supabase, {
    threadId,
    name: `edit-${threadView.branches.length + 1}`,
    createdBy: context.user.id,
    parentBranchId: threadView.activeBranch.id,
    forkCheckpointId: parentCheckpointId,
    headCheckpointId: null,
  });

  const contextMessages = threadView.canonicalMessages.slice(0, -2);
  const editedUserMessage = createTextMessage({
    role: "user",
    text: nextContent,
  });

  const result = await generateText({
    model: createLanguageModel(connection, threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character,
      persona,
      snapshot: priorSnapshot,
      pins: [],
      timeline: parentCheckpointId
        ? threadView.timeline.filter((event) => event.checkpoint_id !== latestCheckpoint.id)
        : [],
    }),
    messages: await convertToModelMessages([...contextMessages, editedUserMessage]),
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
      branchId: branch.id,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
    },
  });

  const storedUser = await persistMessage(context.supabase, threadId, editedUserMessage);
  const storedAssistant = await persistMessage(context.supabase, threadId, assistantMessage);
  const checkpoint = await createCheckpoint(context.supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    parent_checkpoint_id: parentCheckpointId,
    user_message_id: storedUser.id,
    assistant_message_id: storedAssistant.id,
    choice_group_key: `choice:${crypto.randomUUID()}`,
    feedback_rating: null,
    created_by: context.user.id,
  });

  await updateBranchHead(context.supabase, branch.id, checkpoint.id);
  await switchActiveBranch(context.supabase, context.user.id, {
    threadId,
    branchId: branch.id,
  });
  await updateThreadTitle(
    context.supabase,
    context.user.id,
    threadId,
    nextContent.slice(0, 60),
  );

  const reconciliation = await reconcileTurnState({
    connection,
    modelId: threadView.thread.model_id,
    character,
    previousSnapshot: priorSnapshot,
    recentMessages: [...contextMessages, editedUserMessage, assistantMessage].slice(-16),
  });

  await saveSnapshot(
    context.supabase,
    buildSnapshotFromReconciliation({
      checkpointId: checkpoint.id,
      threadId,
      branchId: branch.id,
      previousSnapshot: priorSnapshot,
      reconciliation,
    }),
  );

  await insertTimelineEvent(context.supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    checkpoint_id: checkpoint.id,
    source_message_id: storedAssistant.id,
    title: "Edited reply branch",
    detail: "Forked a new branch from the edited latest user turn.",
    importance: 3,
  });

  if (reconciliation.timelineEvent) {
    await insertTimelineEvent(context.supabase, {
      thread_id: threadId,
      branch_id: branch.id,
      checkpoint_id: checkpoint.id,
      source_message_id: storedAssistant.id,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }

  return Response.json({ ok: true, branchId: branch.id, checkpointId: checkpoint.id });
}
