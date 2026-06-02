import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FIXED_USER_EMAIL,
  FIXED_USER_ID,
  SESSION_COOKIE,
} from "@/lib/auth-config";
import { verifySessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { ProfileRecord } from "@/lib/types";

type AuthedClient = SupabaseClient<Database>;

/**
 * The single user is synthetic: it is not backed by Supabase Auth. Only `.id`
 * (for data ownership scoping) and `.email` (for the identity label in the UI)
 * are ever read downstream, so we cast a minimal object to the `User` shape.
 */
const SYNTHETIC_USER = {
  id: FIXED_USER_ID,
  email: FIXED_USER_EMAIL,
} as unknown as User;

function syntheticProfile(): ProfileRecord {
  const now = new Date().toISOString();
  return {
    id: FIXED_USER_ID,
    email: FIXED_USER_EMAIL,
    is_allowed: true,
    created_at: now,
    updated_at: now,
  } as ProfileRecord;
}

type AuthContext = {
  supabase: AuthedClient | null;
  user: User | null;
  profile: ProfileRecord | null;
  isAllowed: boolean;
};

/**
 * Resolves the current request's auth context from the signed session cookie.
 *
 * There is no Supabase Auth session anymore, so app data is accessed through the
 * service-role admin client (which bypasses RLS). Ownership is still enforced in
 * code via the fixed `user.id` that every query scopes on. When the session
 * cookie is missing or invalid, returns a fully-null context (callers 401 or
 * redirect on `!user`).
 */
export async function getCurrentUser(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!(await verifySessionToken(token))) {
    return { supabase: null, user: null, profile: null, isAllowed: false };
  }

  return {
    supabase: createSupabaseAdminClient(),
    user: SYNTHETIC_USER,
    profile: syntheticProfile(),
    isAllowed: true,
  };
}

/**
 * Requires an authenticated session. If absent, throws via `redirect("/login")`
 * (a Next.js internal error) and never returns. On success it returns a fully
 * narrowed context with a guaranteed `user`, `profile`, and admin `supabase`.
 */
export async function requireAllowedUser() {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.profile) {
    redirect("/login");
  }

  return {
    supabase: context.supabase,
    user: context.user,
    profile: context.profile,
    isAllowed: true as const,
  };
}
