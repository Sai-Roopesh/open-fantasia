import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getAllowedEmails, hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  const allowed = getAllowedEmails();
  return allowed.includes(email.trim().toLowerCase());
}

async function ensureProfileRecord(user: User) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    is_allowed: isAllowedEmail(user.email),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to sync profile record", error);
  }
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { supabase: null, user: null, isAllowed: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfileRecord(user);
  }

  return {
    supabase,
    user,
    isAllowed: isAllowedEmail(user?.email),
  };
}

export async function requireAllowedUser() {
  if (!hasSupabaseEnv()) {
    redirect("/login?reason=setup");
  }

  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    redirect("/login");
  }

  return context as { supabase: NonNullable<typeof context.supabase>; user: User; isAllowed: true };
}

export async function syncProfile(user: User) {
  await ensureProfileRecord(user);
}
