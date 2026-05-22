import { Output, generateText } from "ai";
import type { CharacterBundle } from "@/lib/data/characters";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildReconciliationMessages } from "@/lib/ai/roleplay-prompt";
import type {
  ConnectionRecord,
  FantasiaUIMessage,
  ReconciliationOutput,
  ThreadStateSnapshot,
} from "@/lib/types";
import { reconciliationSchema } from "@/lib/types";
import { dedupeStrings } from "@/lib/utils";

function limitSentenceCount(value: string, maxSentences: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  const sentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= maxSentences) {
    return compact;
  }

  return sentences.slice(0, maxSentences).join(" ").trim();
}

function dedupeAndLimitStrings(values: string[], maxItems: number) {
  return dedupeStrings(values).slice(0, maxItems);
}

export async function reconcileTurnState(args: {
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterBundle;
  previousSnapshot: ThreadStateSnapshot | null;
  recentMessages: FantasiaUIMessage[];
}) {
  const result = await generateText({
    model: createLanguageModel(args.connection, args.modelId),
    messages: buildReconciliationMessages({
      character: args.character,
      snapshot: args.previousSnapshot,
      recentMessages: args.recentMessages,
    }),
    output: Output.object({ schema: reconciliationSchema }),
    temperature: 0.2,
    maxOutputTokens: 700,
  });

  return (await result.output) as ReconciliationOutput;
}

export function buildSnapshotFromReconciliation(args: {
  turnId: string;
  threadId: string;
  branchId: string;
  previousSnapshot: ThreadStateSnapshot | null;
  reconciliation: ReconciliationOutput;
}) {
  return {
    turn_id: args.turnId,
    thread_id: args.threadId,
    branch_id: args.branchId,
    based_on_turn_id: args.previousSnapshot?.turn_id ?? null,
    story_summary: limitSentenceCount(args.reconciliation.storySummary, 12),
    scene_summary: limitSentenceCount(args.reconciliation.sceneSummary, 5),
    last_turn_beat: limitSentenceCount(args.reconciliation.lastTurnBeat, 2),
    relationship_state: limitSentenceCount(args.reconciliation.relationshipState, 3),
    user_facts: dedupeAndLimitStrings(args.reconciliation.userFacts, 8),
    active_threads: dedupeAndLimitStrings(args.reconciliation.activeThreads, 5),
    resolved_threads: dedupeAndLimitStrings(args.reconciliation.resolvedThreads, 5),
    next_turn_pressure: dedupeAndLimitStrings(args.reconciliation.nextTurnPressure, 3),
    scene_goals: dedupeAndLimitStrings(args.reconciliation.sceneGoals, 5),
    version: (args.previousSnapshot?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  } satisfies ThreadStateSnapshot;
}
