import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking turns in database...");
  const { data: turns, error } = await supabase
    .from("chat_turns")
    .select("id, generation_status, failure_code, failure_message, user_input_text, assistant_output_text, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch turns:", error.message);
    return;
  }

  console.log(`Found ${turns.length} turns in total:`);
  turns.forEach((turn, idx) => {
    console.log(`\n[Turn #${idx + 1}] ID: ${turn.id}`);
    console.log(`  Status: ${turn.generation_status}`);
    console.log(`  Created At: ${turn.created_at}`);
    console.log(`  User text: ${turn.user_input_text.slice(0, 100)}...`);
    if (turn.assistant_output_text) {
      console.log(`  Assistant text: ${turn.assistant_output_text.slice(0, 100)}...`);
    }
    if (turn.failure_code || turn.failure_message) {
      console.log(`  Failure Code: ${turn.failure_code}`);
      console.log(`  Failure Message: ${turn.failure_message}`);
    }
  });
}

run().catch(e => console.error(e));
