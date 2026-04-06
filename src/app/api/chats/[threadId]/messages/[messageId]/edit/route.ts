import { convertToModelMessages, generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { finalizeAssistantTurn } from "@/lib/ai/turn-finalizer";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import { createBranch } from "@/lib/data/branches";
import { getSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { createTextMessage, getThreadGraphView, switchActiveBranch } from "@/lib/data/threads";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { editMessageRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = context.supabase;
  const user = context.user;
  const { threadId, messageId } = await params;
  const parsedBody = editMessageRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return Response.json({ error: "Edited content is required." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(supabase, user.id, threadId);
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
    getCharacterBundle(supabase, user.id, threadView.thread.character_id),
    getConnection(supabase, user.id, threadView.thread.connection_id),
    threadView.thread.persona_id
      ? getPersona(supabase, user.id, threadView.thread.persona_id)
      : Promise.resolve(null),
  ]);

  if (!character || !connection || !persona) {
    return Response.json({ error: "Missing thread context." }, { status: 400 });
  }

  const latestCheckpoint = threadView.latestCheckpoint;
  const parentCheckpointId = latestCheckpoint.parent_checkpoint_id;
  const priorSnapshot = parentCheckpointId
    ? await getSnapshot(supabase, parentCheckpointId)
    : null;

  const branch = await createBranch(supabase, {
    threadId,
    name: `edit-${threadView.branches.length + 1}`,
    createdBy: user.id,
    parentBranchId: threadView.activeBranch.id,
    forkCheckpointId: parentCheckpointId,
    headCheckpointId: null,
  });

  const contextMessages = threadView.modelContextMessages.slice(0, -2);
  const editedUserMessage = createTextMessage({
    role: "user",
    text: parsedBody.data.content,
  });
  const generationSettings = resolveThreadGenerationSettings({
    character: character.character,
    thread: threadView.thread,
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
    temperature: generationSettings.temperature,
    topP: generationSettings.topP,
    maxOutputTokens: generationSettings.maxOutputTokens,
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

  const { checkpoint } = await finalizeAssistantTurn({
    supabase,
    userId: user.id,
    thread: threadView.thread,
    branchId: branch.id,
    parentCheckpointId,
    userMessage: editedUserMessage,
    assistantMessage,
    choiceGroupKey: `choice:${crypto.randomUUID()}`,
    previousSnapshot: priorSnapshot,
    connection,
    character,
    modelId: threadView.thread.model_id,
    recentMessages: [...contextMessages, editedUserMessage, assistantMessage],
  });

  await switchActiveBranch(supabase, user.id, {
    threadId,
    branchId: branch.id,
  });

  await insertTimelineEvent(supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    checkpoint_id: checkpoint.id,
    source_message_id: checkpoint.assistant_message_id,
    title: "Edited reply branch",
    detail: "Forked a new branch from the edited latest user turn.",
    importance: 3,
  });

  return Response.json({ ok: true, branchId: branch.id, checkpointId: checkpoint.id });
}
