import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";

/**
 * Daily keep-alive ping. Runs a trivial query so the free-tier Supabase project
 * never sees a week of inactivity and won't auto-pause (a pause takes the whole
 * app down until it is manually resumed). Wired to a Vercel cron in vercel.json.
 *
 * Vercel cron requests carry `Authorization: Bearer ${CRON_SECRET}` when
 * CRON_SECRET is set on the project, so the same gate as the job-drain route
 * applies. GET because Vercel cron jobs issue GET requests.
 */
export async function GET() {
  const authorization = (await headers()).get("authorization");
  const cronSecret = getCronSecret();

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    // Cheapest possible touch: a head count on the tiny profiles table.
    const { error } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Keep-alive ping failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Keep-alive failed." }, { status: 500 });
  }
}
