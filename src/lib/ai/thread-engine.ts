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
  checkpointId: string;
  threadId: string;
  branchId: string;
  previousSnapshot: ThreadStateSnapshot | null;
  reconciliation: ReconciliationOutput;
}) {
  return {
    checkpoint_id: args.checkpointId,
    thread_id: args.threadId,
    branch_id: args.branchId,
    based_on_snapshot_id: args.previousSnapshot?.checkpoint_id ?? null,
    scenario_state: args.reconciliation.scenarioState,
    relationship_state: args.reconciliation.relationshipState,
    rolling_summary: args.reconciliation.rollingSummary,
    user_facts: dedupeStrings(args.reconciliation.userFacts),
    open_loops: dedupeStrings(args.reconciliation.openLoops),
    scene_goals: dedupeStrings(args.reconciliation.sceneGoals),
    version: (args.previousSnapshot?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  } satisfies ThreadStateSnapshot;
}
