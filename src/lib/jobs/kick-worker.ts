import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { drainPendingJobs } from "@/lib/jobs/reconcile-worker";

let draining = false;

export function scheduleBackgroundWorker(limit = 3) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  after(async () => {
    if (draining) return;
    draining = true;
    try {
      await drainPendingJobs(admin, limit);
    } catch {
      // Best-effort only. Vercel Cron or manual worker runs provide the durable path.
    } finally {
      draining = false;
    }
  });
}
