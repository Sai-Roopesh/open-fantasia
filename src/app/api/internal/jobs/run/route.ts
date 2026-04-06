import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCronSecret, getPublicEnv } from "@/lib/env";
import { drainPendingJobs } from "@/lib/jobs/reconcile-worker";

function isLocalRequest(request: Request) {
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (secret) {
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(process.env.NODE_ENV === "development" && isLocalRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const siteUrl = getPublicEnv().siteUrl ?? "this deployment";
    return NextResponse.json(
      {
        error: `Missing admin configuration for ${siteUrl}.`,
      },
      { status: 500 },
    );
  }

  const processed = await drainPendingJobs(supabase, 10);
  return NextResponse.json({ processed });
}
