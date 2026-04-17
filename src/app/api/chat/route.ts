import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  validateUIMessages,
} from "ai";
import { getCurrentUser } from "@/lib/auth";
import {
  assertThreadReadyForNewTurn,
  generateAssistantReply,
  loadThreadGenerationRuntime,
  ThreadGenerationServiceError,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import {
  finalizeAssistantTurn,
  reconcileCheckpointInBand,
} from "@/lib/ai/turn-finalizer";
import { assignServerMessageId } from "@/lib/ai/message-utils";
import { chatRequestSchema } from "@/lib/validation";
import { messageMetadataSchema, type FantasiaUIMessage } from "@/lib/types";

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
    assertThreadReadyForNewTurn(runtime.threadView);
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

  const stableUserMessage = assignServerMessageId(latestUserMessage);
  const contextMessages = [...runtime.threadView.modelContextMessages, stableUserMessage];
  const continuitySnapshot = runtime.threadView.headSnapshot;
  const startedAt = Date.now();

  try {
    const { assistantMessage } = await generateAssistantReply({
      runtime,
      messages: contextMessages,
      snapshot: continuitySnapshot,
    });
    const recentMessages = [
      ...runtime.threadView.modelContextMessages,
      stableUserMessage,
      assistantMessage,
    ];
    const { reconcilePayload, storedAssistant } = await finalizeAssistantTurn({
      supabase,
      userId: user.id,
      thread: runtime.threadView.thread,
      branchId: runtime.threadView.activeBranch.id,
      parentCheckpointId: runtime.threadView.activeBranch.head_checkpoint_id,
      userMessage: stableUserMessage,
      assistantMessage,
      choiceGroupKey: `choice:${crypto.randomUUID()}`,
      recentMessages,
    });
    const reconcileResult = await reconcileCheckpointInBand({
      supabase,
      userId: user.id,
      payload: reconcilePayload,
    });

    if (!reconcileResult.ok) {
      console.error(
        "Immediate continuity reconciliation failed; queued retry.",
        reconcileResult.errorMessage,
      );
    }

    const baseMetadata = {
      provider: runtime.connection.provider,
      model: runtime.threadView.thread.model_id,
      connectionLabel: runtime.connection.label,
      branchId: runtime.threadView.activeBranch.id,
    };
    const finishMetadata = {
      ...baseMetadata,
      finishReason: assistantMessage.metadata?.finishReason,
      totalTokens: assistantMessage.metadata?.totalTokens,
    };
    const finishReason = assistantMessage.metadata?.finishReason;

    return createUIMessageStreamResponse({
      stream: createUIMessageStream<FantasiaUIMessage>({
        execute: ({ writer }) => {
          writer.write({
            type: "start",
            messageId: storedAssistant.id,
            messageMetadata: {
              ...baseMetadata,
              startedAt,
            },
          });
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: "text-1" });

          if (storedAssistant.content_text) {
            writer.write({
              type: "text-delta",
              id: "text-1",
              delta: storedAssistant.content_text,
            });
          }

          writer.write({ type: "text-end", id: "text-1" });
          writer.write({ type: "finish-step" });
          writer.write(
            finishReason
              ? {
                  type: "finish",
                  finishReason: finishReason as
                    | "stop"
                    | "length"
                    | "content-filter"
                    | "tool-calls"
                    | "error"
                    | "other",
                  messageMetadata: finishMetadata,
                }
              : {
                  type: "finish",
                  messageMetadata: finishMetadata,
                },
          );
        },
      }),
    });
  } catch (error) {
    if (error instanceof ThreadGenerationServiceError) {
      return toThreadGenerationErrorResponse(error);
    }

    console.error("Failed to generate and persist chat turn.", error);
    return Response.json({ error: "We couldn't persist that turn." }, { status: 500 });
  }
}
