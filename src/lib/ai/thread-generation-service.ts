import { convertToModelMessages, generateText } from "ai";
import type { CharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import type { DatabaseClient } from "@/lib/data/shared";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import {
  createTextMessage,
  getThreadGraphView,
  type ThreadGraphView,
} from "@/lib/threads/read-model";
import type {
  ConnectionRecord,
  FantasiaUIMessage,
  ThreadGenerationSettings,
  ThreadStateSnapshot,
  TimelineEventRecord,
  UserPersonaRecord,
} from "@/lib/types";

export class ThreadGenerationServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ThreadGenerationServiceError";
  }
}

export type ThreadGenerationRuntime = {
  supabase: DatabaseClient;
  userId: string;
  threadView: ThreadGraphView;
  character: CharacterBundle;
  connection: ConnectionRecord;
  persona: UserPersonaRecord;
  generationSettings: ThreadGenerationSettings;
};

function toPromptTimeline(timeline: TimelineEventRecord[]) {
  return [...timeline].reverse();
}

export async function loadThreadGenerationRuntime(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
}) {
  const threadView = await getThreadGraphView(args.supabase, args.userId, args.threadId);
  if (!threadView) {
    throw new ThreadGenerationServiceError(404, "Thread not found.");
  }

  if (!threadView.thread.persona_id) {
    throw new ThreadGenerationServiceError(
      400,
      "Threads must carry an explicit persona before generation can continue.",
    );
  }

  const [connection, persona] = await Promise.all([
    getConnection(args.supabase, args.userId, threadView.thread.connection_id),
    getPersona(args.supabase, args.userId, threadView.thread.persona_id),
  ]);

  if (!threadView.characterBundle || !connection || !persona) {
    throw new ThreadGenerationServiceError(400, "Missing thread context.");
  }

  return {
    supabase: args.supabase,
    userId: args.userId,
    threadView,
    character: threadView.characterBundle,
    connection,
    persona,
    generationSettings: resolveThreadGenerationSettings({
      character: threadView.characterBundle.character,
      thread: threadView.thread,
    }),
  } satisfies ThreadGenerationRuntime;
}

function buildPendingContinuityMessage() {
  return "The latest continuity snapshot is still being written. Wait for reconciliation to finish before sending the next turn.";
}

export function assertThreadReadyForNewTurn(threadView: ThreadGraphView) {
  if (threadView.activeBranch.generation_locked) {
    throw new ThreadGenerationServiceError(
      409,
      "This branch already has an in-flight generation. Wait for it to finish before sending another turn.",
    );
  }

  if (!threadView.latestTurn || threadView.headSnapshot) {
    return;
  }

  throw new ThreadGenerationServiceError(
    409,
    threadView.headSnapshotFailed
      ? threadView.headSnapshotFailureMessage ??
          "The latest continuity reconciliation failed. Repair the latest turn before continuing."
      : buildPendingContinuityMessage(),
  );
}

export function assertThreadReadyForLatestRewrite(threadView: ThreadGraphView) {
  if (threadView.activeBranch.generation_locked) {
    throw new ThreadGenerationServiceError(
      409,
      "This branch already has an in-flight generation. Wait for it to finish before rewriting the latest turn.",
    );
  }

  if (!threadView.headSnapshotPending) {
    return;
  }

  throw new ThreadGenerationServiceError(
    409,
    buildPendingContinuityMessage(),
  );
}

export function toThreadGenerationErrorResponse(error: unknown) {
  if (error instanceof ThreadGenerationServiceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[toThreadGenerationErrorResponse] Unhandled error:", error);

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "An unexpected error occurred.";

  return Response.json({ error: message }, { status: 500 });
}

export async function generateAssistantReply(args: {
  runtime: ThreadGenerationRuntime;
  messages: FantasiaUIMessage[];
  snapshot: ThreadStateSnapshot | null;
  pins?: ThreadGraphView["pins"];
  timeline?: TimelineEventRecord[];
  assistantMessageId?: string;
}) {
  const result = await generateText({
    model: createLanguageModel(args.runtime.connection, args.runtime.threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character: args.runtime.character,
      persona: args.runtime.persona,
      snapshot: args.snapshot,
      pins: args.pins ?? args.runtime.threadView.pins,
      timeline: toPromptTimeline(args.timeline ?? args.runtime.threadView.timeline),
    }),
    messages: await convertToModelMessages(args.messages),
    temperature: args.runtime.generationSettings.temperature,
    topP: args.runtime.generationSettings.topP,
    maxOutputTokens: args.runtime.generationSettings.maxOutputTokens,
  });

  return {
    result,
    assistantMessage: createTextMessage({
      id: args.assistantMessageId,
      role: "assistant",
      text: result.text,
      metadata: {
        provider: args.runtime.connection.provider,
        model: args.runtime.threadView.thread.model_id,
        connectionLabel: args.runtime.connection.label,
        branchId: args.runtime.threadView.activeBranch.id,
        totalTokens: result.usage.totalTokens,
        finishReason: result.finishReason,
      },
    }),
  };
}
