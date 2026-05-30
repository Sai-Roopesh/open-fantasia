import { getTextFromMessage } from "@/lib/utils/message-text";
import {
  extractStateChanges,
  type ExtractionOutput,
} from "@/lib/ai/state-extraction";
import {
  validateAllMutations,
  validateAndPartition,
  validateEntityMutations,
  validateFactMutations,
  validateLocationEdgeMutations,
  validateNarrativeThreadMutations,
  validateRelationshipMutations,
  validateSpatialMutations,
  type MutationOp,
} from "@/lib/ai/state-validator";
import { reflectOnFailedExtraction } from "@/lib/ai/state-reflector";
import type {
  CharacterRecord,
  ConnectionRecord,
  DurableMemorySnapshot,
  FantasiaUIMessage,
} from "@/lib/types";

function stripInvalidMutations(
  extraction: ExtractionOutput,
  snapshot: DurableMemorySnapshot,
): ExtractionOutput {
  const entities = validateAndPartition(
    extraction.entity_mutations as MutationOp[],
    snapshot,
    validateEntityMutations,
  );
  const facts = validateAndPartition(
    extraction.fact_mutations as MutationOp[],
    snapshot,
    validateFactMutations,
  );
  const relationships = validateAndPartition(
    extraction.relationship_mutations as MutationOp[],
    snapshot,
    validateRelationshipMutations,
  );
  const spatial = validateAndPartition(
    extraction.placement_mutations as MutationOp[],
    snapshot,
    (muts, snap) =>
      validateSpatialMutations(muts, extraction.location_mutations as MutationOp[], snap),
  );
  const narratives = validateAndPartition(
    extraction.narrative_thread_mutations as MutationOp[],
    snapshot,
    validateNarrativeThreadMutations,
  );
  const edges = validateAndPartition(
    extraction.location_edge_mutations as MutationOp[],
    snapshot,
    validateLocationEdgeMutations,
  );

  return {
    ...extraction,
    entity_mutations: entities.valid as ExtractionOutput["entity_mutations"],
    fact_mutations: facts.valid as ExtractionOutput["fact_mutations"],
    relationship_mutations: relationships.valid as ExtractionOutput["relationship_mutations"],
    placement_mutations: spatial.valid as ExtractionOutput["placement_mutations"],
    narrative_thread_mutations: narratives.valid as ExtractionOutput["narrative_thread_mutations"],
    location_edge_mutations: edges.valid as ExtractionOutput["location_edge_mutations"],
  };
}

/**
 * Pure extraction orchestrator: run LLM extraction → validate → optionally reflect
 * → strip remaining invalid mutations → return a clean ExtractionOutput.
 *
 * Zero DB calls. All persistence is handled by services/continuity-service.ts.
 */
export async function runContinuityExtraction(args: {
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterRecord;
  currentSnapshot: DurableMemorySnapshot;
  recentMessages: FantasiaUIMessage[];
  isFullMaterialization: boolean;
}): Promise<ExtractionOutput> {
  const { connection, modelId, character, currentSnapshot, recentMessages, isFullMaterialization } =
    args;

  let extraction = await extractStateChanges({
    connection,
    modelId,
    character,
    currentSnapshot,
    recentMessages,
    isFullMaterialization,
  });

  const validationResult = validateAllMutations(extraction, currentSnapshot);

  if (validationResult.totalErrors > 0) {
    if (validationResult.shouldReflect) {
      const transcript = recentMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${getTextFromMessage(msg)}`)
        .join("\n\n");

      const reflected = await reflectOnFailedExtraction({
        connection,
        modelId,
        character,
        currentSnapshot,
        recentTranscript: transcript,
        previousOutput: extraction,
        validationResult,
      });

      if (reflected) {
        const revalidation = validateAllMutations(reflected, currentSnapshot);
        if (revalidation.totalErrors === 0) {
          extraction = reflected;
        } else {
          extraction = stripInvalidMutations(reflected, currentSnapshot);
        }
      } else {
        extraction = stripInvalidMutations(extraction, currentSnapshot);
      }
    } else {
      extraction = stripInvalidMutations(extraction, currentSnapshot);
    }
  }

  return extraction;
}
