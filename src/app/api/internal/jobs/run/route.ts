import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { drainPendingTasks } from "@/lib/jobs/task-drain";
import { getCronSecret } from "@/lib/env";

export async function POST() {
  const headersList = await headers();
  const authorization = headersList.get("authorization");
  const cronSecret = getCronSecret();

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await drainPendingTasks(supabase);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Manual task drain failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Task drain failed." },
      { status: 500 },
    );
  }
}
