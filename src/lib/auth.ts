import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getAllowedEmails } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  const allowed = getAllowedEmails();
  return allowed.includes(email.trim().toLowerCase());
}

async function syncProfileRecord(user: User) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    is_allowed: isAllowedEmail(user.email),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
    isAllowed: isAllowedEmail(user?.email),
  };
}

export async function requireAllowedUser() {
  const context = await getCurrentUser();
  if (!context.user || !context.isAllowed) {
    redirect("/login");
  }

  return context as { supabase: typeof context.supabase; user: User; isAllowed: true };
}

export async function syncProfile(user: User) {
  await syncProfileRecord(user);
}
