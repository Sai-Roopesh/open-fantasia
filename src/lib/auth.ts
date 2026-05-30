import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getAllowedEmails } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ProfileRecord } from "@/lib/types";

type AuthedClient = SupabaseClient<Database>;

export function isAllowedEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const allowed = getAllowedEmails();
  return allowed.includes(email.trim().toLowerCase());
}

const PROFILE_COLUMNS = "id, email, is_allowed, created_at, updated_at";

/**
 * Ensures a profile row exists for the user and returns it. Shared by both the
 * request-time proxy guard and server-side `getCurrentUser`, so the create /
 * sync logic lives in exactly one place.
 *
 * Creation is race-safe: the upsert with `ignoreDuplicates` is a single atomic
 * `INSERT ... ON CONFLICT DO NOTHING`, so two simultaneous first-time requests
 * can never collide on the primary key. Critically, it never overwrites
 * `is_allowed` for an existing row — runtime authorization is profile-backed and
 * the env allowlist only seeds the value on first insert.
 */
export async function ensureProfileForClient(
  client: AuthedClient,
  user: Pick<User, "id" | "email">,
): Promise<ProfileRecord> {
  const nextEmail = user.email ?? "";

  const { error: seedError } = await client.from("profiles").upsert(
    {
      id: user.id,
      email: nextEmail,
      is_allowed: isAllowedEmail(user.email),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (seedError) {
    throw seedError;
  }

  const { data: existing, error: loadError } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();

  if (loadError) {
    throw loadError;
  }

  const profile = existing as ProfileRecord;
  if (profile.email === nextEmail) {
    return profile;
  }

  const { data: updated, error: updateError } = await client
    .from("profiles")
    .update({ email: nextEmail, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (updateError) {
    throw updateError;
  }

  return updated as ProfileRecord;
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      isAllowed: false,
    };
  }

  const profile = await ensureProfileForClient(supabase, user);

  return {
    supabase,
    user,
    profile,
    isAllowed: profile.is_allowed,
  };
}

/**
 * Requires an authenticated and authorized user. If the user is not logged in
 * or their profile is not allowed, this function throws via `redirect("/login")`
 * (a Next.js internal error) and never returns. On success it returns a fully
 * narrowed context with a guaranteed `user`, `profile`, and `supabase` client.
 */
export async function requireAllowedUser() {
  const context = await getCurrentUser();
  if (!context.user || !context.profile?.is_allowed) {
    redirect("/login");
  }

  return {
    supabase: context.supabase,
    user: context.user,
    profile: context.profile,
    isAllowed: true as const,
  };
}

export async function syncProfile(user: User) {
  const supabase = await createSupabaseServerClient();
  await ensureProfileForClient(supabase, user);
}
