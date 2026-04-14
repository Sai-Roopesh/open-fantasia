import { createIdGenerator, validateUIMessages } from "ai";
import { getCurrentUser } from "@/lib/auth";
import {
  assertThreadReadyForGeneration,
  loadThreadGenerationRuntime,
  streamAssistantReply,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import {
  finalizeAssistantTurn,
  reconcileCheckpointInBand,
} from "@/lib/ai/turn-finalizer";
import { ensureMessageId } from "@/lib/ai/message-utils";
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
  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase,
      userId: user.id,
      threadId,
    });
    assertThreadReadyForGeneration(runtime.threadView);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
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

  const stableUserMessage = ensureMessageId(latestUserMessage);
  const streamMessages = [...runtime.threadView.modelContextMessages, stableUserMessage];
  const continuitySnapshot = runtime.threadView.resolvedSnapshot;

  const result = await streamAssistantReply({
    runtime,
    messages: streamMessages,
    snapshot: continuitySnapshot,
  });

  return result.toUIMessageStreamResponse<FantasiaUIMessage>({
    originalMessages: streamMessages,
    generateMessageId,
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return {
          provider: runtime.connection.provider,
          model: runtime.threadView.thread.model_id,
          connectionLabel: runtime.connection.label,
          branchId: runtime.threadView.activeBranch.id,
          startedAt: Date.now(),
        };
      }

      if (part.type === "finish") {
        return {
          provider: runtime.connection.provider,
          model: runtime.threadView.thread.model_id,
          connectionLabel: runtime.connection.label,
          branchId: runtime.threadView.activeBranch.id,
          finishReason: part.finishReason,
          totalTokens: part.totalUsage.totalTokens,
        };
      }

      return undefined;
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;

      const assistantMessage = ensureMessageId(responseMessage);

      const { reconcilePayload } = await finalizeAssistantTurn({
        supabase,
        userId: user.id,
        thread: runtime.threadView.thread,
        branchId: runtime.threadView.activeBranch.id,
        parentCheckpointId: runtime.threadView.activeBranch.head_checkpoint_id,
        userMessage: stableUserMessage,
        assistantMessage,
        choiceGroupKey: `choice:${crypto.randomUUID()}`,
        recentMessages: [...streamMessages, assistantMessage],
      });
      await reconcileCheckpointInBand({
        supabase,
        userId: user.id,
        payload: reconcilePayload,
      });
    },
  });
}
