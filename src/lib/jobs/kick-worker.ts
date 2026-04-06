import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { drainPendingJobs } from "@/lib/jobs/reconcile-worker";

export function scheduleBackgroundWorker(limit = 3) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  after(async () => {
    try {
      await drainPendingJobs(admin, limit);
    } catch {
      // Best-effort only. Vercel Cron or manual worker runs provide the durable path.
    }
  });
}
