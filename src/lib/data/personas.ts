import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaUsageSummary, UserPersonaRecord } from "@/lib/types";

export async function listPersonas(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserPersonaRecord[];
}

export async function getPersona(
  supabase: SupabaseClient,
  userId: string,
  personaId: string,
) {
  const { data, error } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId)
    .eq("id", personaId)
    .maybeSingle();

  if (error) throw error;
  return data as UserPersonaRecord | null;
}

export async function getDefaultPersona(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  return data as UserPersonaRecord | null;
}

export async function upsertPersona(
  supabase: SupabaseClient,
  userId: string,
  payload: Partial<UserPersonaRecord> & { id?: string; name: string },
) {
  const next = {
    id: payload.id,
    user_id: userId,
    name: payload.name,
    identity: payload.identity ?? "",
    backstory: payload.backstory ?? "",
    voice_style: payload.voice_style ?? "",
    goals: payload.goals ?? "",
    boundaries: payload.boundaries ?? "",
    private_notes: payload.private_notes ?? "",
    is_default: Boolean(payload.is_default),
  };

  if (next.is_default) {
    const { error: resetError } = await supabase
      .from("user_personas")
      .update({ is_default: false })
      .eq("user_id", userId);

    if (resetError) throw resetError;
  }

  const query = payload.id
    ? supabase
        .from("user_personas")
        .update(next)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select("*")
        .single()
    : supabase.from("user_personas").insert(next).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data as UserPersonaRecord;
}

export async function listPersonaUsage(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("persona_id, status")
    .eq("user_id", userId)
    .not("persona_id", "is", null);

  if (error) throw error;

  const usage = new Map<string, PersonaUsageSummary>();
  for (const row of data ?? []) {
    const personaId = row.persona_id as string | null;
    if (!personaId) continue;
    const current = usage.get(personaId) ?? {
      personaId,
      totalThreads: 0,
      activeThreads: 0,
    };
    current.totalThreads += 1;
    if (row.status === "active") {
      current.activeThreads += 1;
    }
    usage.set(personaId, current);
  }

  return Array.from(usage.values());
}

export async function setDefaultPersona(
  supabase: SupabaseClient,
  userId: string,
  personaId: string,
) {
  const { error: resetError } = await supabase
    .from("user_personas")
    .update({ is_default: false })
    .eq("user_id", userId);

  if (resetError) throw resetError;

  const { data, error } = await supabase
    .from("user_personas")
    .update({ is_default: true })
    .eq("id", personaId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as UserPersonaRecord;
}

export async function duplicatePersona(
  supabase: SupabaseClient,
  userId: string,
  personaId: string,
) {
  const persona = await getPersona(supabase, userId, personaId);
  if (!persona) {
    throw new Error("Persona not found.");
  }

  const { data, error } = await supabase
    .from("user_personas")
    .insert({
      user_id: userId,
      name: `${persona.name} Copy`,
      identity: persona.identity,
      backstory: persona.backstory,
      voice_style: persona.voice_style,
      goals: persona.goals,
      boundaries: persona.boundaries,
      private_notes: persona.private_notes,
      is_default: false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as UserPersonaRecord;
}

export async function deletePersona(
  supabase: SupabaseClient,
  userId: string,
  personaId: string,
) {
  const persona = await getPersona(supabase, userId, personaId);
  if (!persona) return;

  const personas = await listPersonas(supabase, userId);
  const replacement =
    personas.find((item) => item.id !== personaId && item.is_default) ??
    personas.find((item) => item.id !== personaId) ??
    null;

  const usage = await listPersonaUsage(supabase, userId);
  const usedInThreads =
    usage.find((summary) => summary.personaId === personaId)?.totalThreads ?? 0;

  if (usedInThreads > 0 && !replacement) {
    throw new Error(
      "Create another persona before deleting the only persona used by your threads.",
    );
  }

  if (replacement) {
    const { error: replaceError } = await supabase
      .from("chat_threads")
      .update({ persona_id: replacement.id })
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (replaceError) throw replaceError;

    if (persona.is_default && !replacement.is_default) {
      await setDefaultPersona(supabase, userId, replacement.id);
    }
  }

  const { error } = await supabase
    .from("user_personas")
    .delete()
    .eq("id", personaId)
    .eq("user_id", userId);

  if (error) throw error;
}
