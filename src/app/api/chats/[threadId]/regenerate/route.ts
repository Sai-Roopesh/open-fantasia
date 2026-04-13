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
import { regenerateRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = context.supabase;
  const user = context.user;
  const { threadId } = await params;
  const parsedBody = regenerateRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid regenerate payload." }, { status: 400 });
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
            "The latest continuity reconciliation failed. Rewind or edit the latest turn before retrying."
          : "The latest continuity reconciliation is still running. Wait for it to finish before regenerating.",
      },
      { status: 409 },
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
  if (
    parsedBody.data.checkpointId &&
    parsedBody.data.checkpointId !== latestCheckpoint.id
  ) {
    return Response.json(
      { error: "Only the latest assistant checkpoint can be regenerated." },
      { status: 400 },
    );
  }

  const contextMessages = threadView.modelContextMessages.slice(0, -1);
  const priorSnapshot = latestCheckpoint.parent_checkpoint_id
    ? await getSnapshot(supabase, latestCheckpoint.parent_checkpoint_id)
    : null;
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
      pins: threadView.pins,
      timeline: [...threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages(contextMessages),
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
    assistantMessage,
    recentMessages: [...contextMessages, assistantMessage],
  });
  scheduleBackgroundWorker(1);

  return Response.json({ ok: true, checkpointId: checkpoint.id });
}
