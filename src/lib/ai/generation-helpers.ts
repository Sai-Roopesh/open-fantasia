import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import type {
  ChatBranchRecord,
  ChatPinRecord,
  ChatTurnRecord,
  ConnectionRecord,
  DurableMemorySnapshot,
  FantasiaUIMessage,
  TimelineEventRecord,
  UserPersonaRecord,
} from "@/lib/types";
import type { CharacterBundle } from "@/lib/data/characters";

export class ThreadGenerationServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ThreadGenerationServiceError";
  }
}

export function toThreadGenerationErrorResponse(error: unknown): Response {
  if (error instanceof ThreadGenerationServiceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[toThreadGenerationErrorResponse] Unhandled error:", error);

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as Record<string, unknown>).message)
        : "An unexpected error occurred.";

  return Response.json({ error: message }, { status: 500 });
}

export function buildGenerationMessages(args: {
  recentSceneMessages: FantasiaUIMessage[];
  pendingMessages?: FantasiaUIMessage[];
}): FantasiaUIMessage[] {
  return [...args.recentSceneMessages, ...(args.pendingMessages ?? [])];
}

const MIN_PROMPT_TIMELINE_IMPORTANCE = 3;
const MAX_PROMPT_TIMELINE_EVENTS = 5;

export function toPromptTimeline(timeline: TimelineEventRecord[]): TimelineEventRecord[] {
  return timeline
    .filter((event) => event.importance >= MIN_PROMPT_TIMELINE_IMPORTANCE)
    .slice(0, MAX_PROMPT_TIMELINE_EVENTS)
    .reverse();
}

export function buildGenerationSystemPrompt(args: {
  character: CharacterBundle;
  persona: UserPersonaRecord | null;
  snapshot: DurableMemorySnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
  directorNotes?: string | null;
  // Optionally pass a connection record for logging (unused in prompt building)
  connection?: ConnectionRecord;
}): string {
  return buildRoleplaySystemPrompt({
    character: args.character,
    persona: args.persona,
    snapshot: args.snapshot,
    pins: args.pins,
    timeline: toPromptTimeline(args.timeline),
    directorNotes: args.directorNotes,
  });
}

export function assertBranchReadyForNewTurn(activeBranch: ChatBranchRecord): void {
  if (activeBranch.generation_locked) {
    throw new ThreadGenerationServiceError(
      409,
      "This branch already has an in-flight generation. Wait for it to finish before sending another turn.",
    );
  }
}

export function assertBranchReadyForRewrite(activeBranch: ChatBranchRecord): void {
  if (activeBranch.generation_locked) {
    throw new ThreadGenerationServiceError(
      409,
      "This branch already has an in-flight generation. Wait for it to finish before rewriting the latest turn.",
    );
  }
}

export function assertLatestTurnRewriteTarget(args: {
  activeBranch: ChatBranchRecord;
  latestTurn: ChatTurnRecord | null;
  branchId: string;
  expectedHeadTurnId: string;
}): ChatTurnRecord {
  if (args.activeBranch.id !== args.branchId) {
    throw new ThreadGenerationServiceError(
      409,
      "The active branch changed before Fantasia could rewrite the latest turn.",
    );
  }

  const { latestTurn } = args;
  if (!latestTurn || latestTurn.id !== args.expectedHeadTurnId) {
    throw new ThreadGenerationServiceError(
      409,
      "The branch head changed before Fantasia could rewrite the latest turn.",
    );
  }

  return latestTurn;
}
