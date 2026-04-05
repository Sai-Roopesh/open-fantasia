"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, hasSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseEnv()) return null;
  if (browserClient) return browserClient;

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
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
