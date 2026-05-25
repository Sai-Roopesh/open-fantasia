import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Manually load env variables from .env.local
const envLocalPath = "/Users/sairoopesh/Documents/projects/Open-Fantasia/.env.local";
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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get all threads
  console.log("=== THREADS ===");
  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id, title, character_id, created_at")
    .order("created_at", { ascending: false });
  
  if (threads) {
    for (const t of threads) {
      console.log(`Thread: ${t.id} | "${t.title}" | Created: ${t.created_at}`);
    }
  }

  // 2. Get all branches
  console.log("\n=== BRANCHES ===");
  const { data: branches } = await supabase
    .from("chat_branches")
    .select("id, thread_id, is_active, generation_locked, parent_turn_id")
    .order("created_at", { ascending: false });
  
  if (branches) {
    for (const b of branches) {
      console.log(`Branch: ${b.id} | Thread: ${b.thread_id} | Active: ${b.is_active} | Locked: ${b.generation_locked}`);
    }
  }

  // 3. Get all turns with content preview
  console.log("\n=== TURNS (last 20) ===");
  const { data: turns } = await supabase
    .from("chat_turns")
    .select("id, branch_id, role, content, ordinal, head_snapshot_id, created_at")
    .order("created_at", { ascending: true })
    .limit(20);
  
  if (turns) {
    for (const t of turns) {
      const preview = (t.content || "").slice(0, 120).replace(/\n/g, " ");
      console.log(`Turn ${t.ordinal} [${t.role}]: ${preview}...`);
      console.log(`  ID: ${t.id} | Branch: ${t.branch_id} | Snapshot: ${t.head_snapshot_id || "NONE"}`);
    }
  }

  // 4. World Snapshots - FULL
  console.log("\n=== WORLD SNAPSHOTS ===");
  const { data: snapshots } = await supabase
    .from("world_snapshots")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (snapshots) {
    for (const s of snapshots) {
      console.log(`\n--- Snapshot for Turn: ${s.turn_id} ---`);
      console.log(`  ID: ${s.id}`);
      console.log(`  Version: ${s.version}`);
      console.log(`  Narrative Timestamp: ${s.narrative_timestamp}`);
      console.log(`  Story Summary:\n    ${s.story_summary}`);
      console.log(`  Scene Summary:\n    ${s.scene_summary}`);
    }
  }

  // 5. World Entities - ALL
  console.log("\n=== WORLD ENTITIES ===");
  const { data: entities } = await supabase
    .from("world_entities")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (entities) {
    for (const e of entities) {
      console.log(`\nEntity: "${e.name}" (${e.entity_type})`);
      console.log(`  ID: ${e.id}`);
      console.log(`  Aliases: ${JSON.stringify(e.aliases)}`);
      console.log(`  Description: ${e.description}`);
      console.log(`  Status: ${e.status}`);
      console.log(`  Thread: ${e.thread_id} | Snapshot: ${e.snapshot_id}`);
    }
  }

  // 6. Entity Facts
  console.log("\n=== WORLD ENTITY FACTS ===");
  const { data: facts } = await supabase
    .from("world_entity_facts")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (facts) {
    for (const f of facts) {
      console.log(`\nFact: "${f.key}" = "${f.value}"`);
      console.log(`  Entity: ${f.entity_id} | Confidence: ${f.confidence}`);
      console.log(`  Source: ${f.source_turn_id}`);
    }
  }

  // 7. Relationships
  console.log("\n=== WORLD RELATIONSHIPS ===");
  const { data: rels } = await supabase
    .from("world_relationships")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (rels) {
    for (const r of rels) {
      console.log(`\nRelationship: "${r.label}" (${r.relationship_type})`);
      console.log(`  From: ${r.source_entity_id} → To: ${r.target_entity_id}`);
      console.log(`  Detail: ${r.detail}`);
      console.log(`  Status: ${r.status}`);
    }
  }

  // 8. Locations
  console.log("\n=== WORLD LOCATIONS ===");
  const { data: locations } = await supabase
    .from("world_locations")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (locations) {
    for (const l of locations) {
      console.log(`\nLocation: "${l.name}" (${l.location_type})`);
      console.log(`  ID: ${l.id}`);
      console.log(`  Description: ${l.description}`);
      console.log(`  Current Mood: ${l.current_mood}`);
      console.log(`  Status: ${l.status}`);
    }
  }

  // 9. Location Edges
  console.log("\n=== WORLD LOCATION EDGES ===");
  const { data: edges } = await supabase
    .from("world_location_edges")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (edges) {
    for (const e of edges) {
      console.log(`Edge: ${e.from_location_id} → ${e.to_location_id} | Type: ${e.edge_type}`);
    }
  }

  // 10. Entity Placements
  console.log("\n=== WORLD ENTITY PLACEMENTS ===");
  const { data: placements } = await supabase
    .from("world_entity_placements")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (placements) {
    for (const p of placements) {
      console.log(`Placement: Entity ${p.entity_id} → Location ${p.location_id}`);
    }
  }

  // 11. Narrative Threads
  console.log("\n=== WORLD NARRATIVE THREADS ===");
  const { data: narratives } = await supabase
    .from("world_narrative_threads")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (narratives) {
    for (const n of narratives) {
      console.log(`\nNarrative Thread: "${n.title}" (${n.thread_status})`);
      console.log(`  ID: ${n.id}`);
      console.log(`  Description: ${n.description}`);
      console.log(`  Participants: ${JSON.stringify(n.participant_entity_ids)}`);
    }
  }

  // 12. Timeline Events
  console.log("\n=== CHAT TIMELINE EVENTS ===");
  const { data: events } = await supabase
    .from("chat_timeline_events")
    .select("*")
    .order("created_at", { ascending: true });
  
  if (events) {
    for (const e of events) {
      console.log(`\nEvent: "${e.title}"`);
      console.log(`  Detail: ${e.detail}`);
      console.log(`  Turn: ${e.turn_id} | Significance: ${e.significance}`);
      console.log(`  Affected Entities: ${JSON.stringify(e.affected_entity_ids)}`);
    }
  }

  // Summary stats
  console.log("\n\n=== SUMMARY ===");
  console.log(`Threads: ${threads?.length || 0}`);
  console.log(`Branches: ${branches?.length || 0}`);
  console.log(`Turns: ${turns?.length || 0}`);
  console.log(`Snapshots: ${snapshots?.length || 0}`);
  console.log(`Entities: ${entities?.length || 0}`);
  console.log(`Facts: ${facts?.length || 0}`);
  console.log(`Relationships: ${rels?.length || 0}`);
  console.log(`Locations: ${locations?.length || 0}`);
  console.log(`Location Edges: ${edges?.length || 0}`);
  console.log(`Placements: ${placements?.length || 0}`);
  console.log(`Narrative Threads: ${narratives?.length || 0}`);
  console.log(`Timeline Events: ${events?.length || 0}`);
}

run().catch((e) => console.error(e));
