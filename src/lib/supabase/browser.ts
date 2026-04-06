"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseEnv()) return null;
  if (browserClient) return browserClient;

  const { supabaseUrl, supabasePublishableKey } = requireSupabasePublicEnv();
  browserClient = createBrowserClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
  );
  return browserClient;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}
