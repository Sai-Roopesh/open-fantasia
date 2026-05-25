import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { getWorldSnapshot } from "../src/lib/data/world-state";
import { getCharacterBundle } from "../src/lib/data/characters";
import { listConnections } from "../src/lib/data/connections";
import { listTurnsForThread, toTranscriptMessages } from "../src/lib/data/turns";
import { buildTurnPath } from "../src/lib/threads/read-model";
import { materializeDurableSnapshot, buildEmptyDurableSnapshot } from "../src/lib/ai/state-materializer";
import { extractStateChanges } from "../src/lib/ai/state-extraction";
import { validateAllMutations } from "../src/lib/ai/state-validator";

const envLocalPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envLocalPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim();
    env[key] = val;
  }
}

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = env["SUPABASE_SERVICE_ROLE_KEY"];
const appEncryptionKey = env["APP_ENCRYPTION_KEY"];

process.env.APP_ENCRYPTION_KEY = appEncryptionKey;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const turnId = "ab2155ad-55b7-4198-869a-b73f3be9327a"; // Turn #7
  console.log(`Analyzing Turn: ${turnId}`);

  // Fetch turn details to get branchId and parentTurnId
  const { data: turnDetails } = await supabase
    .from("chat_turns")
    .select("id, thread_id, branch_origin_id, parent_turn_id, generation_status, reserved_by_user_id")
    .eq("id", turnId)
    .single();

  console.log("Turn details:", turnDetails);

  const threadId = turnDetails.thread_id;
  const branchId = turnDetails.branch_origin_id;
  const userId = turnDetails.reserved_by_user_id;

  const connections = await listConnections(supabase, userId);
  const connection = connections.find(c => c.enabled);
  if (!connection) {
    console.error("No connection.");
    return;
  }

  const { data: threadData } = await supabase
    .from("chat_threads")
    .select("character_id, model_id")
    .eq("id", threadId)
    .single();

  const characterBundle = await getCharacterBundle(supabase, userId, threadData.character_id);
  const allTurns = await listTurnsForThread(supabase, threadId);
  
  let previousSnapshotRecord = null;
  if (turnDetails.parent_turn_id) {
    previousSnapshotRecord = await getWorldSnapshot(supabase, turnDetails.parent_turn_id);
  }

  console.log("Previous snapshot record:", previousSnapshotRecord ? "Found" : "Not Found");

  const currentSnapshot = previousSnapshotRecord
    ? await materializeDurableSnapshot(supabase, threadId, branchId, turnId, previousSnapshotRecord)
    : buildEmptyDurableSnapshot(turnId);

  console.log("Current Snapshot materialized. Tracked Entities count:", currentSnapshot.entity_state.length);
  if (currentSnapshot.entity_state.length > 0) {
    console.log("Entities in snapshot:", currentSnapshot.entity_state.map(e => `${e.canonical_name} (${e.entity_id})`));
  }

  const turnPath = buildTurnPath(allTurns, turnId);
  const committedTurns = turnPath.filter((t) => t.generation_status === "committed");
  const recentMessages = committedTurns.slice(-15).flatMap((t) => toTranscriptMessages(t));

  console.log("Running HCE pipeline simulation...");
  try {
    let extraction = await extractStateChanges({
      connection,
      modelId: threadData.model_id,
      character: characterBundle.character,
      currentSnapshot,
      recentMessages,
    });

    console.log("Extraction output generated successfully.");
    console.log("Story Summary:", extraction.story_summary.slice(0, 100) + "...");
    
    console.log("Validating mutations...");
    const validationResult = validateAllMutations(extraction, currentSnapshot);
    console.log("Validation errors count:", validationResult.totalErrors);
    if (validationResult.totalErrors > 0) {
      console.log("Validation Errors:", validationResult.errors);
    }

    console.log("Attempting to apply mutations to DB...");
    
    // We can simulate applying mutations by running each step manually to catch the exact error
    const newEntityIds = new Map<string, string>();
    const newLocationIds = new Map<string, string>();

    const {
      insertEntity,
      insertEntityFact,
      insertRelationship,
      insertLocation,
      insertLocationEdge,
      insertEntityPlacement,
      insertNarrativeThread,
      updateEntity,
      updateRelationship,
      updateLocation,
      updateNarrativeThread,
      invalidateEntity,
      invalidateEntityFact,
      invalidateRelationship,
      invalidateLocationEdge,
      invalidateEntityPlacement,
    } = require("../src/lib/data/world-state");

    function resolveNewRef(value: string, map: Map<string, string>): string {
      const key = value.startsWith("NEW:") ? value : `NEW:${value}`;
      return map.get(key) ?? value;
    }

    console.log("Entity mutations:", extraction.entity_mutations);
    for (const m of extraction.entity_mutations) {
      if (m.op === "add") {
        const result = await insertEntity(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          canonical_name: m.canonical_name!,
          entity_type: m.entity_type,
          aliases: m.aliases ?? [],
          is_present: m.is_present ?? true,
          primary_emotion: m.primary_emotion ?? "neutral",
          emotion_intensity: m.emotion_intensity ?? 5,
          emotion_catalyst: m.emotion_catalyst ?? "",
          valid_from_turn_id: turnId,
        });
        newEntityIds.set(`NEW:${m.canonical_name}`, result.id);
        console.log(`Added entity ${m.canonical_name} as ${result.id}`);
      } else if (m.op === "update") {
        await updateEntity(supabase, m.entity_id!, m.changes!);
        console.log(`Updated entity ${m.entity_id}`);
      } else if (m.op === "invalidate") {
        await invalidateEntity(supabase, m.entity_id!, turnId);
        console.log(`Invalidated entity ${m.entity_id}`);
      }
    }

    console.log("Fact mutations:", extraction.fact_mutations);
    for (const m of extraction.fact_mutations) {
      if (m.op === "add") {
        const resolvedEntityId = resolveNewRef(m.entity_id!, newEntityIds);
        await insertEntityFact(supabase, {
          entity_id: resolvedEntityId,
          thread_id: threadId,
          branch_id: branchId,
          fact_type: m.fact_type,
          body: m.body!,
          valid_from_turn_id: turnId,
        });
        console.log(`Added fact for entity ${resolvedEntityId}`);
      } else if (m.op === "invalidate") {
        await invalidateEntityFact(supabase, m.fact_id!, turnId);
        console.log(`Invalidated fact ${m.fact_id}`);
      }
    }

    console.log("Relationship mutations:", extraction.relationship_mutations);
    for (const m of extraction.relationship_mutations) {
      if (m.op === "add") {
        const resolvedSourceId = resolveNewRef(m.source_entity_id!, newEntityIds);
        const resolvedTargetId = resolveNewRef(m.target_entity_id!, newEntityIds);
        await insertRelationship(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          source_entity_id: resolvedSourceId,
          target_entity_id: resolvedTargetId,
          relationship_type: m.relationship_type,
          dynamic_status: m.dynamic_status!,
          valid_from_turn_id: turnId,
        });
        console.log(`Added relationship from ${resolvedSourceId} to ${resolvedTargetId}`);
      } else if (m.op === "update") {
        await updateRelationship(supabase, m.relationship_id!, m.changes!);
        console.log(`Updated relationship ${m.relationship_id}`);
      } else if (m.op === "invalidate") {
        await invalidateRelationship(supabase, m.relationship_id!, turnId);
        console.log(`Invalidated relationship ${m.relationship_id}`);
      }
    }

    console.log("Location mutations:", extraction.location_mutations);
    for (const m of extraction.location_mutations) {
      if (m.op === "add") {
        const result = await insertLocation(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          canonical_name: m.canonical_name!,
          description: m.description ?? "",
          environmental_modifiers: m.environmental_modifiers ?? [],
          valid_from_turn_id: turnId,
        });
        newLocationIds.set(`NEW:${m.canonical_name}`, result.id);
        console.log(`Added location ${m.canonical_name} as ${result.id}`);
      } else if (m.op === "update") {
        await updateLocation(supabase, m.location_id!, m.changes!);
        console.log(`Updated location ${m.location_id}`);
      }
    }

    console.log("Location edge mutations:", extraction.location_edge_mutations);
    for (const m of extraction.location_edge_mutations) {
      if (m.op === "add") {
        const resolvedFromId = resolveNewRef(m.from_location_id!, newLocationIds);
        const resolvedToId = resolveNewRef(m.to_location_id!, newLocationIds);
        await insertLocationEdge(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          from_location_id: resolvedFromId,
          to_location_id: resolvedToId,
          is_bidirectional: m.is_bidirectional ?? true,
          valid_from_turn_id: turnId,
        });
        console.log(`Added location edge from ${resolvedFromId} to ${resolvedToId}`);
      } else if (m.op === "invalidate") {
        await invalidateLocationEdge(supabase, m.edge_id!, turnId);
        console.log(`Invalidated location edge ${m.edge_id}`);
      }
    }

    console.log("Placement mutations:", extraction.placement_mutations);
    for (const m of extraction.placement_mutations) {
      const resolvedEntityId = resolveNewRef(m.entity_id, newEntityIds);
      const resolvedLocationId = resolveNewRef(m.to_location_id, newLocationIds);
      await invalidateEntityPlacement(supabase, resolvedEntityId, turnId);
      await insertEntityPlacement(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        entity_id: resolvedEntityId,
        location_id: resolvedLocationId,
        micro_position: m.micro_position ?? "",
        valid_from_turn_id: turnId,
      });
      console.log(`Moved entity ${resolvedEntityId} to location ${resolvedLocationId}`);
    }

    console.log("Narrative thread mutations:", extraction.narrative_thread_mutations);
    for (const m of extraction.narrative_thread_mutations) {
      if (m.op === "add") {
        await insertNarrativeThread(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          objective: m.objective!,
          status: "open",
          dependency_ids: [],
          valid_from_turn_id: turnId,
        });
        console.log(`Added narrative thread: ${m.objective}`);
      } else if (m.op === "update") {
        await updateNarrativeThread(supabase, m.thread_id!, m.changes!);
        console.log(`Updated narrative thread ${m.thread_id}`);
      } else if (m.op === "resolve") {
        await updateNarrativeThread(supabase, m.thread_id!, { status: "resolved" });
        console.log(`Resolved narrative thread ${m.thread_id}`);
      }
    }

    console.log("Simulation of database mutations finished successfully!");

  } catch (err) {
    console.error("HCE Simulation failed! Error details:");
    console.error(util.inspect(err, { depth: null, colors: true }));
  }
}

run().catch(console.error);
