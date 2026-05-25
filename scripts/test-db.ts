import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

async function checkTable(tableName: string) {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, count };
}

async function run() {
  console.log("Checking HCE Database Tables...");
  console.log("Supabase URL:", supabaseUrl);

  const tables = [
    "world_snapshots",
    "world_entities",
    "world_entity_facts",
    "world_relationships",
    "world_locations",
    "world_location_edges",
    "world_entity_placements",
    "world_narrative_threads",
    "chat_timeline_events",
    "characters",
    "chat_threads",
    "chat_turns"
  ];

  for (const table of tables) {
    const res = await checkTable(table);
    if (res.success) {
      console.log(`- ${table}: ${res.count} records`);
    } else {
      console.log(`- ${table}: FAILED (${res.error})`);
    }
  }

  // Fetch some sample data from world_snapshots
  console.log("\nRecent World Snapshots (Up to 3):");
  const { data: snapshots, error: snapErr } = await supabase
    .from("world_snapshots")
    .select("turn_id, story_summary, narrative_timestamp, version")
    .order("created_at", { ascending: false })
    .limit(3);

  if (snapErr) {
    console.error("Failed to fetch world_snapshots sample:", snapErr.message);
  } else if (snapshots && snapshots.length > 0) {
    snapshots.forEach((snap, index) => {
      console.log(`[Snapshot #${index + 1}] Turn ID: ${snap.turn_id}`);
      console.log(`  Version: ${snap.version}`);
      console.log(`  Narrative Timestamp: ${snap.narrative_timestamp}`);
      console.log(`  Story Summary: ${snap.story_summary.slice(0, 150)}...`);
    });
  } else {
    console.log("No world snapshots found.");
  }
}

run().catch((e) => console.error(e));
