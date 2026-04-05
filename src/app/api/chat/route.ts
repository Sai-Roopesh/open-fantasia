import { convertToModelMessages, streamText, validateUIMessages } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { reconcileTurnState, buildSnapshotFromReconciliation } from "@/lib/ai/thread-engine";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import {
  createCheckpoint,
  getThreadGraphView,
  insertTimelineEvent,
  persistMessage,
  saveSnapshot,
  updateBranchHead,
  updateThreadTitle,
} from "@/lib/data/threads";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { messageMetadataSchema, type FantasiaUIMessage } from "@/lib/types";

type ChatRequestBody = {
  threadId?: string;
  id?: string;
  messages?: FantasiaUIMessage[];
};

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const threadId = body.threadId ?? body.id;
  if (!threadId || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid chat payload." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
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
    return Response.json(
      { error: "The thread is missing its character, provider connection, or persona." },
      { status: 400 },
    );
  }

  const incomingMessages = (await validateUIMessages({
    messages: body.messages.map((message) => ({
      ...message,
      metadata: message.metadata ?? {},
    })),
    metadataSchema: messageMetadataSchema,
  })) as FantasiaUIMessage[];

  const latestUserMessage = [...incomingMessages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return Response.json(
      { error: "A user message is required to continue the thread." },
      { status: 400 },
    );
  }

  const canonicalMessages = threadView.canonicalMessages;
  const streamMessages = [...canonicalMessages, latestUserMessage];

  const result = streamText({
    model: createLanguageModel(connection, threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character,
      persona,
      snapshot: threadView.headSnapshot,
      pins: threadView.pins,
      timeline: [...threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages(streamMessages),
    temperature: 0.92,
    topP: 0.94,
    maxOutputTokens: 750,
  });

  return result.toUIMessageStreamResponse<FantasiaUIMessage>({
    originalMessages: streamMessages,
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return {
          provider: connection.provider,
          model: threadView.thread.model_id,
          connectionLabel: connection.label,
          branchId: threadView.activeBranch.id,
          startedAt: Date.now(),
        };
      }

      if (part.type === "finish") {
        return {
          provider: connection.provider,
          model: threadView.thread.model_id,
          connectionLabel: connection.label,
          branchId: threadView.activeBranch.id,
          finishReason: part.finishReason,
          totalTokens: part.totalUsage.totalTokens,
        };
      }

      return undefined;
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;

      const storedUser = await persistMessage(context.supabase!, threadId, latestUserMessage);
      const storedAssistant = await persistMessage(context.supabase!, threadId, responseMessage);
      const checkpoint = await createCheckpoint(context.supabase!, {
        thread_id: threadId,
        branch_id: threadView.activeBranch.id,
        parent_checkpoint_id: threadView.activeBranch.head_checkpoint_id,
        user_message_id: storedUser.id,
        assistant_message_id: storedAssistant.id,
        choice_group_key: `choice:${crypto.randomUUID()}`,
        feedback_rating: null,
        created_by: context.user!.id,
      });

      await updateBranchHead(context.supabase!, threadView.activeBranch.id, checkpoint.id);
      await updateThreadTitle(
        context.supabase!,
        context.user!.id,
        threadId,
        storedUser.content_text.slice(0, 60) || threadView.thread.title,
      );

      const reconciliation = await reconcileTurnState({
        connection,
        modelId: threadView.thread.model_id,
        character,
        previousSnapshot: threadView.headSnapshot,
        recentMessages: [...streamMessages, responseMessage].slice(-16),
      });

      await saveSnapshot(
        context.supabase!,
        buildSnapshotFromReconciliation({
          checkpointId: checkpoint.id,
          threadId,
          branchId: threadView.activeBranch.id,
          previousSnapshot: threadView.headSnapshot,
          reconciliation,
        }),
      );

      if (reconciliation.timelineEvent) {
        await insertTimelineEvent(context.supabase!, {
          thread_id: threadId,
          branch_id: threadView.activeBranch.id,
          checkpoint_id: checkpoint.id,
          source_message_id: storedAssistant.id,
          title: reconciliation.timelineEvent.title,
          detail: reconciliation.timelineEvent.detail,
          importance: reconciliation.timelineEvent.importance,
        });
      }
    },
  });
}
