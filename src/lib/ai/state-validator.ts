import type { DurableMemorySnapshot } from "@/lib/types";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function validateEntityId(entityId: string, snapshot: DurableMemorySnapshot): boolean {
  return snapshot.entity_state.some((e) => e.entity_id === entityId);
}

function validateLocationId(locationId: string, snapshot: DurableMemorySnapshot): boolean {
  const currentLoc = snapshot.spatial_state.current_location;
  if (currentLoc && currentLoc.id === locationId) return true;
  if (snapshot.spatial_state.adjacent_locations.some((l) => l.id === locationId)) return true;
  if (snapshot.spatial_state.entity_placements.some((p) => p.location_id === locationId)) return true;
  return false;
}

function validateRelationshipId(relationshipId: string, snapshot: DurableMemorySnapshot): boolean {
  return snapshot.relational_state.some((r) => r.relationship_id === relationshipId);
}

function validateNarrativeThreadId(threadId: string, snapshot: DurableMemorySnapshot): boolean {
  return snapshot.narrative_state.active_threads.some((t) => t.thread_id === threadId);
}

export type MutationOp = { op: string; [key: string]: unknown };

export function validateEntityMutations(
  mutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  for (const m of mutations) {
    if (m.op === "update" || m.op === "invalidate") {
      const entityId = m.entity_id as string;
      if (!validateEntityId(entityId, snapshot)) {
        errors.push(`Entity mutation references unknown entity_id: ${entityId}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateFactMutations(
  mutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  for (const m of mutations) {
    if (m.op === "add") {
      const entityId = m.entity_id as string;
      // Allow NEW: refs that point to entities being created in the same extraction
      if (!entityId.startsWith("NEW:") && !validateEntityId(entityId, snapshot)) {
        errors.push(`Fact add references unknown entity_id: ${entityId}`);
      }
    }
    if (m.op === "invalidate") {
      const factId = m.fact_id as string;
      if (!factId) {
        errors.push("Fact invalidate requires a non-empty fact_id.");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRelationshipMutations(
  mutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  for (const m of mutations) {
    if (m.op === "add") {
      const sourceId = m.source_entity_id as string;
      const targetId = m.target_entity_id as string;
      if (!sourceId.startsWith("NEW:") && !validateEntityId(sourceId, snapshot)) {
        errors.push(`Relationship add references unknown source_entity_id: ${sourceId}`);
      }
      if (!targetId.startsWith("NEW:") && !validateEntityId(targetId, snapshot)) {
        errors.push(`Relationship add references unknown target_entity_id: ${targetId}`);
      }
    }
    if (m.op === "update" || m.op === "invalidate") {
      const relId = m.relationship_id as string;
      if (!validateRelationshipId(relId, snapshot)) {
        errors.push(`Relationship mutation references unknown relationship_id: ${relId}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateLocationEdgeMutations(
  mutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  for (const m of mutations) {
    if (m.op === "add") {
      const fromId = m.from_location_id as string;
      const toId = m.to_location_id as string;
      if (!fromId.startsWith("NEW:") && !validateLocationId(fromId, snapshot)) {
        errors.push(`Location edge add references unknown from_location_id: ${fromId}`);
      }
      if (!toId.startsWith("NEW:") && !validateLocationId(toId, snapshot)) {
        errors.push(`Location edge add references unknown to_location_id: ${toId}`);
      }
    }
    if (m.op === "invalidate") {
      const edgeId = m.edge_id as string;
      if (!edgeId) {
        errors.push("Location edge invalidate requires a non-empty edge_id.");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSpatialMutations(
  placementMutations: MutationOp[],
  locationMutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  const newLocationNames = new Set<string>();
  for (const m of locationMutations) {
    if (m.op === "add") {
      newLocationNames.add(m.canonical_name as string);
    }
  }

  for (const m of placementMutations) {
    if (m.op === "move") {
      const entityId = m.entity_id as string;
      const toLocationId = m.to_location_id as string;
      if (!entityId.startsWith("NEW:") && !validateEntityId(entityId, snapshot)) {
        errors.push(`Placement move references unknown entity_id: ${entityId}`);
      }
      // Check if the destination is a known location OR a NEW: ref matching a location being added
      const isNewLocationRef =
        toLocationId.startsWith("NEW:") &&
        newLocationNames.has(toLocationId.replace(/^NEW:/, ""));
      if (!validateLocationId(toLocationId, snapshot) && !isNewLocationRef) {
        errors.push(`Placement move to unknown location_id: ${toLocationId}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateNarrativeThreadMutations(
  mutations: MutationOp[],
  snapshot: DurableMemorySnapshot,
): ValidationResult {
  const errors: string[] = [];

  for (const m of mutations) {
    if (m.op === "update" || m.op === "resolve") {
      const threadId = m.thread_id as string;
      if (!validateNarrativeThreadId(threadId, snapshot)) {
        errors.push(`Narrative thread mutation references unknown thread_id: ${threadId}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export type PartitionedMutations<T> = {
  valid: T[];
  invalid: T[];
  errors: string[];
  shouldReflect: boolean;
};

export function validateAndPartition<T extends MutationOp>(
  mutations: T[],
  snapshot: DurableMemorySnapshot,
  validator: (mutations: MutationOp[], snapshot: DurableMemorySnapshot) => ValidationResult,
): PartitionedMutations<T> {
  const valid: T[] = [];
  const invalid: T[] = [];
  const allErrors: string[] = [];

  for (const m of mutations) {
    const result = validator([m], snapshot);
    if (result.valid) {
      valid.push(m);
    } else {
      invalid.push(m);
      allErrors.push(...result.errors);
    }
  }

  const totalOps = mutations.length;
  const invalidCount = invalid.length;
  const shouldReflect = totalOps > 0 && invalidCount / totalOps > 0.5;

  return { valid, invalid, errors: allErrors, shouldReflect };
}

export type FullValidationResult = {
  entityErrors: string[];
  factErrors: string[];
  relationshipErrors: string[];
  spatialErrors: string[];
  locationEdgeErrors: string[];
  narrativeThreadErrors: string[];
  totalErrors: number;
  shouldReflect: boolean;
};

export function validateAllMutations(
  extraction: {
    entity_mutations: MutationOp[];
    fact_mutations: MutationOp[];
    relationship_mutations: MutationOp[];
    location_mutations: MutationOp[];
    placement_mutations: MutationOp[];
    location_edge_mutations: MutationOp[];
    narrative_thread_mutations: MutationOp[];
  },
  snapshot: DurableMemorySnapshot,
): FullValidationResult {
  const entityResult = validateEntityMutations(extraction.entity_mutations, snapshot);
  const factResult = validateFactMutations(extraction.fact_mutations, snapshot);
  const relResult = validateRelationshipMutations(extraction.relationship_mutations, snapshot);
  const spatialResult = validateSpatialMutations(
    extraction.placement_mutations,
    extraction.location_mutations,
    snapshot,
  );
  const edgeResult = validateLocationEdgeMutations(extraction.location_edge_mutations, snapshot);
  const narrativeResult = validateNarrativeThreadMutations(
    extraction.narrative_thread_mutations,
    snapshot,
  );

  const totalErrors =
    entityResult.errors.length +
    factResult.errors.length +
    relResult.errors.length +
    spatialResult.errors.length +
    edgeResult.errors.length +
    narrativeResult.errors.length;

  const totalOps =
    extraction.entity_mutations.length +
    extraction.fact_mutations.length +
    extraction.relationship_mutations.length +
    extraction.location_mutations.length +
    extraction.placement_mutations.length +
    extraction.location_edge_mutations.length +
    extraction.narrative_thread_mutations.length;

  return {
    entityErrors: entityResult.errors,
    factErrors: factResult.errors,
    relationshipErrors: relResult.errors,
    spatialErrors: spatialResult.errors,
    locationEdgeErrors: edgeResult.errors,
    narrativeThreadErrors: narrativeResult.errors,
    totalErrors,
    shouldReflect: totalOps > 0 && totalErrors / totalOps > 0.5,
  };
}
