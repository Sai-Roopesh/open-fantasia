import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

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
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Raw dump of all world tables with exact column names
  
  console.log("=== RAW world_entities (first 5) ===");
  const { data: entities } = await supabase.from("world_entities").select("*").limit(5);
  if (entities?.[0]) {
    console.log("COLUMNS:", Object.keys(entities[0]).join(", "));
    for (const e of entities) {
      console.log(JSON.stringify(e, null, 2));
    }
  }

  console.log("\n=== RAW world_entity_facts (first 5) ===");
  const { data: facts } = await supabase.from("world_entity_facts").select("*").limit(5);
  if (facts?.[0]) {
    console.log("COLUMNS:", Object.keys(facts[0]).join(", "));
    for (const f of facts) {
      console.log(JSON.stringify(f, null, 2));
    }
  }

  console.log("\n=== RAW world_relationships (first 5) ===");
  const { data: rels } = await supabase.from("world_relationships").select("*").limit(5);
  if (rels?.[0]) {
    console.log("COLUMNS:", Object.keys(rels[0]).join(", "));
    for (const r of rels) {
      console.log(JSON.stringify(r, null, 2));
    }
  }

  console.log("\n=== RAW world_locations (first 5) ===");
  const { data: locs } = await supabase.from("world_locations").select("*").limit(5);
  if (locs?.[0]) {
    console.log("COLUMNS:", Object.keys(locs[0]).join(", "));
    for (const l of locs) {
      console.log(JSON.stringify(l, null, 2));
    }
  }

  console.log("\n=== RAW world_narrative_threads (all) ===");
  const { data: nts } = await supabase.from("world_narrative_threads").select("*");
  if (nts?.[0]) {
    console.log("COLUMNS:", Object.keys(nts[0]).join(", "));
    for (const n of nts) {
      console.log(JSON.stringify(n, null, 2));
    }
  }

  console.log("\n=== RAW world_snapshots (all) ===");
  const { data: snaps } = await supabase.from("world_snapshots").select("*");
  if (snaps?.[0]) {
    console.log("COLUMNS:", Object.keys(snaps[0]).join(", "));
    for (const s of snaps) {
      console.log(JSON.stringify(s, null, 2));
    }
  }

  console.log("\n=== RAW chat_turns (all) ===");
  const { data: turns } = await supabase.from("chat_turns").select("id, branch_origin_id, role, ordinal, generation_status, parent_turn_id, head_snapshot_id, content, created_at").order("created_at", { ascending: true });
  if (turns) {
    console.log(`Total turns: ${turns.length}`);
    for (const t of turns) {
      const preview = (t.content || "").slice(0, 200).replace(/\n/g, " ");
      console.log(`\nTurn ${t.ordinal} [${t.role}] status=${t.generation_status}`);
      console.log(`  ID: ${t.id}`);
      console.log(`  Branch: ${t.branch_origin_id}`);
      console.log(`  Parent: ${t.parent_turn_id}`);
      console.log(`  Snapshot: ${t.head_snapshot_id}`);
      console.log(`  Content: ${preview}...`);
    }
  }
  
  console.log("\n=== RAW chat_branches (all) ===");
  const { data: branches } = await supabase.from("chat_branches").select("*");
  if (branches) {
    for (const b of branches) {
      console.log(JSON.stringify(b, null, 2));
    }
  }
}

run().catch(console.error);
