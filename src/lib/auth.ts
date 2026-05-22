import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getAllowedEmails } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRecord } from "@/lib/types";

export function isAllowedEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const allowed = getAllowedEmails();
  return allowed.includes(email.trim().toLowerCase());
}

async function ensureProfileRecord(
  user: User,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data: existing, error: loadError } = await client
    .from("profiles")
    .select("id, email, is_allowed, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (existing) {
    const nextEmail = user.email ?? "";
    if (existing.email !== nextEmail) {
      const { data: updated, error: updateError } = await client
        .from("profiles")
        .update({
          email: nextEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id, email, is_allowed, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      return updated as ProfileRecord;
    }

    return existing as ProfileRecord;
  }

  const { data, error } = await client
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      // Runtime authorization is profile-backed. The env allowlist only bootstraps
      // first-time profiles so a private deployment can self-seed access safely.
      is_allowed: isAllowedEmail(user.email),
    })
    .select("id, email, is_allowed, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRecord;
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

  const profile = await ensureProfileRecord(user, supabase);

  return {
    supabase,
    user,
    profile,
    isAllowed: profile.is_allowed,
  };
}

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
  await ensureProfileRecord(user);
}
