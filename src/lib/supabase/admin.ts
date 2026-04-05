import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
