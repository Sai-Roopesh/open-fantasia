import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { drainPendingTasks } from "@/lib/jobs/reconcile-worker";

export function scheduleTaskDrain(trigger: string, limit = 4) {
  after(async () => {
    try {
      const supabase = createSupabaseAdminClient();
      const result = await drainPendingTasks(supabase, limit);
      console.info("Background task drain completed.", {
        trigger,
        ...result,
      });
    } catch (error) {
      console.error("Failed to drain background tasks.", {
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
