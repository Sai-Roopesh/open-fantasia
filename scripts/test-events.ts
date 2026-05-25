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
  console.log("Checking timeline events in database...");
  const { data: events, error } = await supabase
    .from("chat_timeline_events")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch events:", error.message);
    return;
  }

  console.log(`Found ${events.length} events:`);
  events.forEach((event, idx) => {
    console.log(`\n[Event #${idx + 1}] ID: ${event.id}`);
    console.log(`  Title: ${event.title}`);
    console.log(`  Detail: ${event.detail}`);
    console.log(`  Type: ${event.event_type}`);
    console.log(`  Importance: ${event.importance}`);
  });
}

run().catch(e => console.error(e));
