import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv, requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) return null;

  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can be read-only during render. Proxy/route handlers
          // handle the writable cookie path.
        }
      },
    },
  });
}
