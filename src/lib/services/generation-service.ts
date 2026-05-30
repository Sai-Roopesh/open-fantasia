import { convertToModelMessages, generateText, smoothStream, streamText } from "ai";
import { getTextFromMessage } from "@/lib/utils/message-text";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { insertTimelineEvent } from "@/lib/data/timeline";
import {
  assertBranchReadyForNewTurn,
  assertBranchReadyForRewrite,
  assertLatestTurnRewriteTarget,
  buildGenerationMessages,
  buildGenerationSystemPrompt,
  ThreadGenerationServiceError,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/generation-helpers";
import { parseWorldSnapshot } from "@/lib/domain/world-snapshot";
import { getWorldSnapshot } from "@/lib/data/world-state";
import { beginTurn, commitTurn, failTurn, markTurnStreaming } from "@/lib/data/turns";
import { createTextMessage } from "@/lib/domain/message-factory";
import { buildRecentSceneMessages } from "@/lib/domain/turn-projections";
import { materializeSnapshotForTurn } from "@/lib/services/continuity-service";
import { loadGenerationRuntime, type GenerationRuntime } from "@/lib/services/generation-runtime";
import { buildSliceResponse } from "@/lib/services/slice-service";
import type { DatabaseClient } from "@/lib/data/shared";
import type { DurableMemorySnapshot, FantasiaUIMessage } from "@/lib/types";

function toRouteError(error: unknown): Response {
  if (error instanceof ThreadGenerationServiceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Fantasia could not start that turn." }, { status: 409 });
}

/**
 * Commits a streamed turn, then materializes its continuity snapshot.
 *
 * These are deliberately separated: if the commit fails the turn never landed,
 * so we fail it and rethrow. But once the commit succeeds the assistant text is
 * persisted and already delivered to the client — a subsequent materialization
 * failure must NOT fail the committed turn (which would corrupt the thread into
 * a blocked state). It is logged and left for the next generation/page load,
 * where loadGenerationRuntime re-materializes any missing head snapshot.
 */
async function commitThenMaterialize(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  branchId: string;
  turnId: string;
  runtime: GenerationRuntime;
  commit: Parameters<typeof commitTurn>[1];
}): Promise<void> {
  const { supabase, userId, threadId, branchId, turnId, runtime, commit } = args;

  try {
    await commitTurn(supabase, commit);
  } catch (error) {
    await failTurn(supabase, {
      branchId,
      turnId,
      failureCode: "commit_error",
      failureMessage:
        error instanceof Error ? error.message : "Fantasia could not persist the completed turn.",
    }).catch(() => undefined);
    throw error;
  }

  try {
    await materializeSnapshotForTurn({
      supabase,
      userId,
      threadId,
      turnId,
      connection: runtime.brainConnection,
      modelId: runtime.brainModelId,
      character: runtime.character.character,
    });
  } catch (error) {
    console.error("[HCE] Post-commit materialization failed; will retry on next load.", {
      threadId,
      turnId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function streamNewTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  branchId: string;
  expectedHeadTurnId?: string | null;
  text: string;
}): Promise<Response> {
  const { supabase, userId, threadId, branchId, expectedHeadTurnId, text } = args;

  let runtime: GenerationRuntime;
  try {
    runtime = await loadGenerationRuntime(supabase, userId, threadId);
    assertBranchReadyForNewTurn(runtime.assembly.activeBranch);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  if (runtime.assembly.activeBranch.id !== branchId) {
    return Response.json(
      { error: "The active branch changed before this turn was sent." },
      { status: 409 },
    );
  }

  let reservedTurn: Awaited<ReturnType<typeof beginTurn>>;
  let system: string;
  let messages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    reservedTurn = await beginTurn(supabase, {
      branchId,
      expectedHeadTurnId,
      text,
    });
    await markTurnStreaming(supabase, reservedTurn.thread_id, reservedTurn.id);

    const userMessage = createTextMessage({
      id: `${reservedTurn.id}:user`,
      role: "user",
      text,
      metadata: { createdAt: reservedTurn.created_at, turnId: reservedTurn.id, branchId },
    });

    system = buildGenerationSystemPrompt({
      character: runtime.character,
      persona: runtime.persona,
      snapshot: runtime.snapshot.snapshot,
      pins: runtime.assembly.pins,
      timeline: runtime.assembly.timeline,
    });

    messages = await convertToModelMessages(
      buildGenerationMessages({
        recentSceneMessages: buildRecentSceneMessages(runtime.assembly.turns),
        pendingMessages: [userMessage],
      }),
    );
  } catch (error) {
    return toRouteError(error);
  }

  let turnSettled = false;
  let result;
  try {
    const model = createLanguageModel(runtime.connection, runtime.assembly.thread.model_id);
    result = streamText({
      model,
      system,
      messages,
      temperature: runtime.generationSettings.temperature,
      topP: runtime.generationSettings.topP,
      maxOutputTokens: runtime.generationSettings.maxOutputTokens,
      experimental_transform: smoothStream({ chunking: "word" }),
      onError: async ({ error }) => {
        if (turnSettled) return;
        turnSettled = true;
        await failTurn(supabase, {
          branchId,
          turnId: reservedTurn.id,
          failureCode: "generation_error",
          failureMessage:
            error instanceof Error ? error.message : "The model stream failed before completion.",
        }).catch((e) => {
          console.error("Failed to persist streaming failure.", {
            threadId,
            branchId,
            turnId: reservedTurn.id,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      },
      onFinish: async (event) => {
        if (turnSettled) return;
        turnSettled = true;
        await commitThenMaterialize({
          supabase,
          userId,
          threadId,
          branchId,
          turnId: reservedTurn.id,
          runtime,
          commit: {
            branchId,
            turnId: reservedTurn.id,
            assistantText: event.text,
            provider: event.model.provider,
            model: event.model.modelId,
            connectionLabel: runtime.connection.label,
            finishReason: event.finishReason ?? null,
            totalTokens: event.totalUsage.totalTokens ?? null,
            promptTokens: event.totalUsage.inputTokens ?? null,
            completionTokens: event.totalUsage.outputTokens ?? null,
          },
        });
      },
    });
  } catch (error) {
    if (!turnSettled) {
      turnSettled = true;
      await failTurn(supabase, {
        branchId,
        turnId: reservedTurn!.id,
        failureCode: "generation_error",
        failureMessage:
          error instanceof Error ? error.message : "Failed to initialize generation stream.",
      }).catch((e) => {
        console.error("Failed to persist initialization failure.", {
          threadId,
          branchId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }
    return toRouteError(error);
  }

  return result.toUIMessageStreamResponse({
    generateMessageId: () => `${reservedTurn.id}:assistant`,
    messageMetadata: () => ({
      provider: runtime.connection.provider,
      model: runtime.assembly.thread.model_id,
      connectionLabel: runtime.connection.label,
      branchId,
      turnId: reservedTurn.id,
    }),
  });
}

export async function streamRewriteTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  branchId: string;
  expectedHeadTurnId: string;
  text?: string;
  mode: "regenerate" | "user";
  guidance?: string;
}): Promise<Response> {
  const { supabase, userId, threadId, branchId, expectedHeadTurnId, text, mode, guidance } = args;

  let runtime: GenerationRuntime;
  try {
    runtime = await loadGenerationRuntime(supabase, userId, threadId);
    assertBranchReadyForRewrite(runtime.assembly.activeBranch);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  let latestTurn: ReturnType<typeof assertLatestTurnRewriteTarget>;
  try {
    latestTurn = assertLatestTurnRewriteTarget({
      activeBranch: runtime.assembly.activeBranch,
      latestTurn: runtime.assembly.latestTurn,
      branchId,
      expectedHeadTurnId,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  const preservedUserPayload =
    mode === "regenerate" && Array.isArray(latestTurn.user_input_payload)
      ? latestTurn.user_input_payload
      : undefined;
  const userText = mode === "regenerate" ? latestTurn.user_input_text : text!;

  let reservedTurn: Awaited<ReturnType<typeof beginTurn>>;
  let system: string;
  let messages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    reservedTurn = await beginTurn(supabase, {
      branchId,
      expectedHeadTurnId,
      text: userText,
      payload: preservedUserPayload,
      parentTurnIdOverride: latestTurn.parent_turn_id,
      forceParentOverride: true,
      hiddenFromTranscript: latestTurn.user_input_hidden,
      starterSeed: latestTurn.starter_seed,
    });
    await markTurnStreaming(supabase, reservedTurn.thread_id, reservedTurn.id);

    const rewrittenUserMessage = createTextMessage({
      id: `${reservedTurn.id}:user`,
      role: "user",
      text: userText,
      metadata: {
        createdAt: reservedTurn.created_at,
        turnId: reservedTurn.id,
        branchId,
        hiddenFromTranscript: latestTurn.user_input_hidden,
        starterSeed: latestTurn.starter_seed,
      },
    });

    const previousSnapshotRecord = latestTurn.parent_turn_id
      ? await getWorldSnapshot(supabase, latestTurn.parent_turn_id)
      : null;
    const previousSnapshot: DurableMemorySnapshot | null = previousSnapshotRecord
      ? parseWorldSnapshot(previousSnapshotRecord)
      : null;

    system = buildGenerationSystemPrompt({
      character: runtime.character,
      persona: runtime.persona,
      snapshot: previousSnapshot,
      pins: runtime.assembly.pins,
      timeline: runtime.assembly.timeline,
    });

    const contextTurns = runtime.assembly.turns.slice(0, -1);
    const guidanceText = guidance?.trim();
    const pendingMessages = guidanceText
      ? [rewrittenUserMessage, createTextMessage({
          role: "user",
          text: buildRegenerationGuidancePrompt(guidanceText),
          metadata: { hiddenFromTranscript: true },
        })]
      : [rewrittenUserMessage];
    messages = await convertToModelMessages(
      buildGenerationMessages({
        recentSceneMessages: buildRecentSceneMessages(contextTurns),
        pendingMessages,
      }),
    );
  } catch (error) {
    return toRouteError(error);
  }

  let turnSettled = false;
  let result;
  try {
    const model = createLanguageModel(runtime.connection, runtime.assembly.thread.model_id);
    result = streamText({
      model,
      system,
      messages,
      temperature: runtime.generationSettings.temperature,
      topP: runtime.generationSettings.topP,
      maxOutputTokens: runtime.generationSettings.maxOutputTokens,
      experimental_transform: smoothStream({ chunking: "word" }),
      onError: async ({ error }) => {
        if (turnSettled) return;
        turnSettled = true;
        await failTurn(supabase, {
          branchId,
          turnId: reservedTurn.id,
          failureCode: "generation_error",
          failureMessage:
            error instanceof Error ? error.message : "The model stream failed before completion.",
        }).catch(() => undefined);
      },
      onFinish: async (event) => {
        if (turnSettled) return;
        turnSettled = true;
        await commitThenMaterialize({
          supabase,
          userId,
          threadId,
          branchId,
          turnId: reservedTurn.id,
          runtime,
          commit: {
            branchId,
            turnId: reservedTurn.id,
            assistantText: event.text,
            provider: event.model.provider,
            model: event.model.modelId,
            connectionLabel: runtime.connection.label,
            finishReason: event.finishReason ?? null,
            totalTokens: event.totalUsage.totalTokens ?? null,
            promptTokens: event.totalUsage.inputTokens ?? null,
            completionTokens: event.totalUsage.outputTokens ?? null,
            // Replace the prior head turn: delete it (and its snapshot) so the
            // rewrite leaves no orphan.
            replaceTurnId: latestTurn.id,
          },
        });
      },
    });
  } catch (error) {
    if (!turnSettled) {
      turnSettled = true;
      await failTurn(supabase, {
        branchId,
        turnId: reservedTurn!.id,
        failureCode: "generation_error",
        failureMessage:
          error instanceof Error ? error.message : "Failed to initialize generation stream.",
      }).catch(() => undefined);
    }
    return toRouteError(error);
  }

  return result.toUIMessageStreamResponse({
    generateMessageId: () => `${reservedTurn.id}:assistant`,
    messageMetadata: () => ({
      provider: runtime.connection.provider,
      model: runtime.assembly.thread.model_id,
      connectionLabel: runtime.connection.label,
      branchId,
      turnId: reservedTurn.id,
    }),
  });
}

/**
 * Non-streaming generation for the rewrite and starter routes.
 */
export async function generateReply(args: {
  runtime: GenerationRuntime;
  messages: FantasiaUIMessage[];
  snapshot: DurableMemorySnapshot | null;
  assistantMessageId?: string;
}): Promise<{
  result: Awaited<ReturnType<typeof generateText>>;
  assistantMessage: FantasiaUIMessage;
}> {
  const { runtime, messages, snapshot, assistantMessageId } = args;

  const result = await generateText({
    model: createLanguageModel(runtime.connection, runtime.assembly.thread.model_id),
    system: buildGenerationSystemPrompt({
      character: runtime.character,
      persona: runtime.persona,
      snapshot,
      pins: runtime.assembly.pins,
      timeline: runtime.assembly.timeline,
    }),
    messages: await convertToModelMessages(messages),
    temperature: runtime.generationSettings.temperature,
    topP: runtime.generationSettings.topP,
    maxOutputTokens: runtime.generationSettings.maxOutputTokens,
  });

  const assistantMessage = createTextMessage({
    id: assistantMessageId,
    role: "assistant",
    text: result.text,
    metadata: {
      provider: runtime.connection.provider,
      model: runtime.assembly.thread.model_id,
      connectionLabel: runtime.connection.label,
      branchId: runtime.assembly.activeBranch.id,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
    },
  });

  return { result, assistantMessage };
}

/**
 * Non-streaming rewrite of the latest turn.
 * Handles all three modes: user-edit + regenerate (generate new reply),
 * and assistant-direct-edit (commit provided text without generation).
 * Returns a slice Response for read-your-writes.
 */
export async function rewriteLatestTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  branchId: string;
  expectedHeadTurnId: string;
  mode: "user" | "assistant" | "regenerate";
  text?: string;
}): Promise<Response> {
  const { supabase, userId, threadId, branchId, expectedHeadTurnId, mode, text } = args;

  let runtime: GenerationRuntime;
  try {
    runtime = await loadGenerationRuntime(supabase, userId, threadId);
    assertBranchReadyForRewrite(runtime.assembly.activeBranch);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  let latestTurn: ReturnType<typeof assertLatestTurnRewriteTarget>;
  try {
    latestTurn = assertLatestTurnRewriteTarget({
      activeBranch: runtime.assembly.activeBranch,
      latestTurn: runtime.assembly.latestTurn,
      branchId,
      expectedHeadTurnId,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  const preservedUserPayload = Array.isArray(latestTurn.user_input_payload)
    ? latestTurn.user_input_payload
    : undefined;
  const userText = mode === "user" ? text! : latestTurn.user_input_text;

  let reservedTurn: Awaited<ReturnType<typeof beginTurn>> | undefined;
  try {
    reservedTurn = await beginTurn(supabase, {
      branchId,
      expectedHeadTurnId,
      text: userText,
      payload: mode === "user" ? undefined : preservedUserPayload,
      parentTurnIdOverride: latestTurn.parent_turn_id,
      forceParentOverride: true,
      hiddenFromTranscript: latestTurn.user_input_hidden,
      starterSeed: latestTurn.starter_seed,
    });

    if (mode === "assistant") {
      await commitTurn(supabase, {
        branchId,
        turnId: reservedTurn.id,
        assistantText: text!,
        provider: null,
        model: null,
        connectionLabel: null,
        finishReason: "edited",
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        replaceTurnId: latestTurn.id,
      });
    } else {
      const contextTurns = runtime.assembly.turns.slice(0, -1);
      const rewrittenUserMessage = createTextMessage({
        role: "user",
        text: userText,
        metadata: {
          turnId: reservedTurn.id,
          branchId,
          hiddenFromTranscript: latestTurn.user_input_hidden,
          starterSeed: latestTurn.starter_seed,
        },
      });

      const previousSnapshotRecord = latestTurn.parent_turn_id
        ? await getWorldSnapshot(supabase, latestTurn.parent_turn_id)
        : null;
      const previousSnapshot: DurableMemorySnapshot | null = previousSnapshotRecord
        ? parseWorldSnapshot(previousSnapshotRecord)
        : null;

      const { assistantMessage, result } = await generateReply({
        runtime,
        messages: buildGenerationMessages({
          recentSceneMessages: buildRecentSceneMessages(contextTurns),
          pendingMessages: [rewrittenUserMessage],
        }),
        snapshot: previousSnapshot,
      });

      await commitTurn(supabase, {
        branchId,
        turnId: reservedTurn.id,
        assistantText: getTextFromMessage(assistantMessage),
        provider: runtime.connection.provider,
        model: runtime.assembly.thread.model_id,
        connectionLabel: runtime.connection.label,
        finishReason: assistantMessage.metadata?.finishReason ?? null,
        totalTokens: result.usage.totalTokens ?? null,
        promptTokens: result.usage.inputTokens ?? null,
        completionTokens: result.usage.outputTokens ?? null,
        replaceTurnId: latestTurn.id,
      });
    }

    await materializeSnapshotForTurn({
      supabase,
      userId,
      threadId,
      turnId: reservedTurn.id,
      connection: runtime.brainConnection,
      modelId: runtime.brainModelId,
      character: runtime.character.character,
    });

    // buildSliceResponse imported at top
    return buildSliceResponse(supabase, userId, threadId);
  } catch (error) {
    if (reservedTurn) {
      await failTurn(supabase, {
        branchId,
        turnId: reservedTurn.id,
        failureCode: "LATEST_TURN_REWRITE_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "An unknown error occurred during rewrite.",
      }).catch(() => undefined);
    }
    return toThreadGenerationErrorResponse(error);
  }
}

function buildRegenerationGuidancePrompt(guidance: string): string {
  return [
    "Hidden direction for how to regenerate your previous reply.",
    "This is out-of-character instruction from the user, not dialogue — do not quote it or acknowledge it in the scene.",
    "Rewrite your reply to the latest exchange so that it follows this direction while staying in character and consistent with the established state.",
    "",
    `Direction: ${guidance}`,
  ].join("\n");
}

function buildStarterSeedPrompt(starter: string): string {
  return [
    "Use this as hidden scene guidance for your very first reply in the thread.",
    "This is not literal user dialogue, and it should not appear verbatim in the transcript unless you naturally adapt parts of it.",
    "Open the scene in character, establish the moment vividly, and leave room for the user to answer next.",
    "",
    `Starter seed: ${starter}`,
  ].join("\n");
}

/**
 * Non-streaming generation of the thread's opening turn from a hidden seed.
 * Only allowed before the first visible turn.
 * Returns a slice Response for read-your-writes.
 */
export async function generateStarterTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  starter: string;
}): Promise<Response> {
  const { supabase, userId, threadId, starter } = args;

  let runtime: GenerationRuntime;
  try {
    runtime = await loadGenerationRuntime(supabase, userId, threadId);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  if (runtime.assembly.turns.length > 0) {
    return Response.json(
      { error: "Starter openings can only be used before the first turn." },
      { status: 400 },
    );
  }

  const starterText = buildStarterSeedPrompt(starter);
  let reservedTurn: Awaited<ReturnType<typeof beginTurn>> | undefined;
  try {
    reservedTurn = await beginTurn(supabase, {
      branchId: runtime.assembly.activeBranch.id,
      expectedHeadTurnId: runtime.assembly.activeBranch.head_turn_id,
      text: starterText,
      hiddenFromTranscript: true,
      starterSeed: true,
    });

    const starterMessage = createTextMessage({
      role: "user",
      text: starterText,
      metadata: {
        hiddenFromTranscript: true,
        starterSeed: true,
        turnId: reservedTurn.id,
        branchId: runtime.assembly.activeBranch.id,
      },
    });

    const { assistantMessage, result } = await generateReply({
      runtime,
      messages: buildGenerationMessages({
        recentSceneMessages: buildRecentSceneMessages(runtime.assembly.turns),
        pendingMessages: [starterMessage],
      }),
      snapshot: runtime.snapshot.snapshot,
    });

    await commitTurn(supabase, {
      branchId: runtime.assembly.activeBranch.id,
      turnId: reservedTurn.id,
      assistantText: getTextFromMessage(assistantMessage),
      provider: runtime.connection.provider,
      model: runtime.assembly.thread.model_id,
      connectionLabel: runtime.connection.label,
      finishReason: assistantMessage.metadata?.finishReason ?? null,
      totalTokens: result.usage.totalTokens ?? null,
      promptTokens: result.usage.inputTokens ?? null,
      completionTokens: result.usage.outputTokens ?? null,
    });

    await insertTimelineEvent(supabase, {
      thread_id: threadId,
      branch_id: runtime.assembly.activeBranch.id,
      turn_id: reservedTurn.id,
      title: "Starter opening generated",
      detail: "Opened the scene from a seeded first-turn prompt.",
      importance: 2,
      event_type: "beat",
      affected_entity_ids: [],
      affected_relationship_ids: [],
    });

    await materializeSnapshotForTurn({
      supabase,
      userId,
      threadId,
      turnId: reservedTurn.id,
      connection: runtime.brainConnection,
      modelId: runtime.brainModelId,
      character: runtime.character.character,
    });

    // buildSliceResponse imported at top
    return buildSliceResponse(supabase, userId, threadId);
  } catch (error) {
    if (reservedTurn) {
      await failTurn(supabase, {
        branchId: runtime.assembly.activeBranch.id,
        turnId: reservedTurn.id,
        failureCode: "GENERATION_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "An unknown error occurred during generation.",
      }).catch(() => undefined);
    }
    return toThreadGenerationErrorResponse(error);
  }
}
