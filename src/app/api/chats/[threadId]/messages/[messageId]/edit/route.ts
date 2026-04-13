import { convertToModelMessages, generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { rewriteCheckpointTurnInPlace } from "@/lib/ai/turn-finalizer";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import { getSnapshot } from "@/lib/data/snapshots";
import { createTextMessage, getThreadGraphView } from "@/lib/data/threads";
import { scheduleBackgroundWorker } from "@/lib/jobs/kick-worker";
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
  if (threadView.headSnapshotPending || threadView.headSnapshotFailed) {
    return Response.json(
      {
        error: threadView.headSnapshotFailed
          ? threadView.headSnapshotFailureMessage ??
            "The latest continuity reconciliation failed. Rewind or retry from the latest turn before editing."
          : "The latest continuity reconciliation is still running. Wait for it to finish before editing the latest turn.",
      },
      { status: 409 },
    );
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

  const contextMessages = threadView.modelContextMessages.slice(0, -2);
  const editedUserMessage = createTextMessage({
    id: latestCheckpoint.user_message_id,
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
    id: latestCheckpoint.assistant_message_id,
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

  const { checkpoint } = await rewriteCheckpointTurnInPlace({
    supabase,
    userId: user.id,
    thread: threadView.thread,
    branchId: threadView.activeBranch.id,
    checkpoint: latestCheckpoint,
    userMessage: editedUserMessage,
    assistantMessage,
    recentMessages: [...contextMessages, editedUserMessage, assistantMessage],
  });
  scheduleBackgroundWorker(1);

  return Response.json({ ok: true, branchId: threadView.activeBranch.id, checkpointId: checkpoint.id });
}
