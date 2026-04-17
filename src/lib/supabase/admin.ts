import { createClient } from "@supabase/supabase-js";
import {
  requireSupabasePublicEnv,
  requireSupabaseServiceRoleKey,
} from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  const { supabaseUrl } = requireSupabasePublicEnv();
  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
