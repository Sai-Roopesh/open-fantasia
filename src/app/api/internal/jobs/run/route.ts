import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/env";
import { drainPendingTasks } from "@/lib/jobs/reconcile-worker";

export async function POST(request: Request) {
  const secret = requireCronSecret();
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const processed = await drainPendingTasks(supabase, 10);
  return NextResponse.json(processed);
}
