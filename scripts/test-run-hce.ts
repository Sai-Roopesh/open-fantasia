import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { materializeSnapshotForTurn } from "../src/lib/ai/continuity";
import { getCharacterBundle } from "../src/lib/data/characters";
import { listConnections } from "../src/lib/data/connections";

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

if (!supabaseUrl || !supabaseKey || !appEncryptionKey) {
  console.error("Missing credentials or encryption key in .env.local");
  process.exit(1);
}

process.env.APP_ENCRYPTION_KEY = appEncryptionKey;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching latest turn details...");

  const { data: turns, error: turnsErr } = await supabase
    .from("chat_turns")
    .select("id, thread_id, reserved_by_user_id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (turnsErr || !turns || turns.length === 0) {
    console.error("No turns found to test:", turnsErr?.message);
    return;
  }

  const latestTurn = turns[0];
  const { id: turnId, thread_id: threadId, reserved_by_user_id: userId } = latestTurn;

  console.log(`Using Turn: ${turnId}`);
  console.log(`Using Thread: ${threadId}`);
  console.log(`Using User: ${userId}`);

  // Fetch connections for this user
  const connections = await listConnections(supabase, userId);
  const connection = connections.find(c => c.enabled);
  if (!connection) {
    console.error("No enabled connections found for user.");
    return;
  }

  // Fetch character bundle
  const { data: threadData } = await supabase
    .from("chat_threads")
    .select("character_id, model_id")
    .eq("id", threadId)
    .single();

  if (!threadData) {
    console.error("Thread not found.");
    return;
  }

  const characterBundle = await getCharacterBundle(supabase, userId, threadData.character_id);
  if (!characterBundle) {
    console.error("Character not found.");
    return;
  }

  console.log(`Using Connection: ${connection.label}`);
  console.log(`Using Model: ${threadData.model_id}`);
  console.log(`Using Character: ${characterBundle.character.name}`);

  // Delete existing snapshot to force HCE to run
  console.log("Deleting existing world_snapshots for this turn...");
  await supabase.from("world_snapshots").delete().eq("turn_id", turnId);

  console.log("\nRunning HCE materializeSnapshotForTurn...");

  try {
    const result = await materializeSnapshotForTurn({
      supabase,
      userId,
      threadId,
      turnId,
      connection,
      modelId: threadData.model_id,
      character: characterBundle.character,
    });

    console.log("\nRESULT SUMMARY:");
    if (result) {
      console.log("Success! Materialized snapshot:");
      console.log("  Story Summary:", result.narrative_state.story_summary);
      console.log("  Scene Summary:", result.narrative_state.scene_summary);
      console.log("  Tracked Entities:", result.entity_state.map(e => e.canonical_name));
    } else {
      console.log("Returned null.");
    }
  } catch (err) {
    console.error("\nHCE ENGINE EXCEPTION THROWN:");
    console.error(err);
  }
}

run().catch(e => console.error(e));
