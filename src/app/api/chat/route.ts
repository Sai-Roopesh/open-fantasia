import {
  convertToModelMessages,
  createIdGenerator,
  streamText,
  validateUIMessages,
} from "ai";
import { getCurrentUser } from "@/lib/auth";
import { finalizeAssistantTurn } from "@/lib/ai/turn-finalizer";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import { getThreadGraphView } from "@/lib/data/threads";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { ensureMessageId } from "@/lib/ai/message-utils";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { chatRequestSchema } from "@/lib/validation";
import { messageMetadataSchema, type FantasiaUIMessage } from "@/lib/types";

const generateMessageId = createIdGenerator({
  prefix: "msg",
  size: 16,
});

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = context.supabase;
  const user = context.user;

  const parsedBody = chatRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid chat payload." }, { status: 400 });
  }

  const { threadId, messages } = parsedBody.data;
  const threadView = await getThreadGraphView(supabase, user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const [character, connection, persona] = await Promise.all([
    getCharacterBundle(supabase, user.id, threadView.thread.character_id),
    getConnection(supabase, user.id, threadView.thread.connection_id),
    threadView.thread.persona_id
      ? getPersona(supabase, user.id, threadView.thread.persona_id)
      : Promise.resolve(null),
  ]);

  if (!character || !connection || !persona) {
    return Response.json(
      { error: "The thread is missing its character, provider connection, or persona." },
      { status: 400 },
    );
  }

  const incomingMessages = await validateUIMessages<FantasiaUIMessage>({
    messages,
    metadataSchema: messageMetadataSchema,
  });

  const latestUserMessage = [...incomingMessages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return Response.json(
      { error: "A user message is required to continue the thread." },
      { status: 400 },
    );
  }

  const continuitySnapshot = threadView.latestCheckpoint ? threadView.headSnapshot : null;
  if (threadView.latestCheckpoint && !continuitySnapshot) {
    return Response.json(
      {
        error:
          "This thread is missing the latest continuity snapshot. Repair the thread state before sending a new turn.",
      },
      { status: 409 },
    );
  }

  const stableUserMessage = ensureMessageId(latestUserMessage);
  const streamMessages = [...threadView.modelContextMessages, stableUserMessage];
  const generationSettings = resolveThreadGenerationSettings({
    character: character.character,
    thread: threadView.thread,
  });

  const result = streamText({
    model: createLanguageModel(connection, threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character,
      persona,
      snapshot: continuitySnapshot,
      pins: threadView.pins,
      timeline: [...threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages(streamMessages),
    temperature: generationSettings.temperature,
    topP: generationSettings.topP,
    maxOutputTokens: generationSettings.maxOutputTokens,
  });

  return result.toUIMessageStreamResponse<FantasiaUIMessage>({
    originalMessages: streamMessages,
    generateMessageId,
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

      const assistantMessage = ensureMessageId(responseMessage);

      await finalizeAssistantTurn({
        supabase,
        userId: user.id,
        thread: threadView.thread,
        branchId: threadView.activeBranch.id,
        parentCheckpointId: threadView.activeBranch.head_checkpoint_id,
        userMessage: stableUserMessage,
        assistantMessage,
        choiceGroupKey: `choice:${crypto.randomUUID()}`,
        previousSnapshot: continuitySnapshot,
        connection,
        character,
        modelId: threadView.thread.model_id,
        recentMessages: [...streamMessages, assistantMessage],
      });
    },
  });
}
