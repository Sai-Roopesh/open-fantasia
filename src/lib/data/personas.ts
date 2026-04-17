import type { PersonaUsageSummary, UserPersonaRecord } from "@/lib/types";
import { castRow, castRows, type DatabaseClient } from "@/lib/data/shared";

const personaSelect = [
  "id",
  "user_id",
  "name",
  "identity",
  "backstory",
  "voice_style",
  "goals",
  "boundaries",
  "private_notes",
  "is_default",
  "created_at",
  "updated_at",
].join(", ");

export async function listPersonas(supabase: DatabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_personas")
    .select(personaSelect)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return castRows<UserPersonaRecord>(data);
}

export async function getPersona(
  supabase: DatabaseClient,
  userId: string,
  personaId: string,
) {
  const { data, error } = await supabase
    .from("user_personas")
    .select(personaSelect)
    .eq("user_id", userId)
    .eq("id", personaId)
    .maybeSingle();

  if (error) throw error;
  return data ? castRow<UserPersonaRecord>(data) : null;
}

export async function getDefaultPersona(
  supabase: DatabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_personas")
    .select(personaSelect)
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  return data ? castRow<UserPersonaRecord>(data) : null;
}

export async function upsertPersona(
  supabase: DatabaseClient,
  userId: string,
  payload: Partial<UserPersonaRecord> & { id?: string; name: string },
) {
  const shouldSetDefault = Boolean(payload.is_default);
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
    is_default: false,
  };

  const query = payload.id
    ? supabase
        .from("user_personas")
        .update(next)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(personaSelect)
        .single()
    : supabase
        .from("user_personas")
        .insert(next)
        .select(personaSelect)
        .single();

  const { data, error } = await query;
  if (error) throw error;

  const persona = castRow<UserPersonaRecord>(data, "User persona");
  return shouldSetDefault ? setDefaultPersona(supabase, userId, persona.id) : persona;
}

export async function listPersonaUsage(
  supabase: DatabaseClient,
  userId: string,
) {
  const { data, error } = await supabase.rpc("list_persona_usage", {
    p_user_id: userId,
  });

  if (error) throw error;
  return castRows<{
    persona_id: string;
    total_threads: number;
    active_threads: number;
  }>(data ?? [], "Persona usage").map(
    (row) =>
      ({
        personaId: row.persona_id,
        totalThreads: Number(row.total_threads),
        activeThreads: Number(row.active_threads),
      }) satisfies PersonaUsageSummary,
  );
}

export async function setDefaultPersona(
  supabase: DatabaseClient,
  userId: string,
  personaId: string,
) {
  const { data, error } = await supabase
    .rpc("set_default_persona", {
      target_persona_id: personaId,
      target_user_id: userId,
    });

  if (error) throw error;

  const personas = castRows<UserPersonaRecord>(data ?? [], "Default personas");
  const exactMatch =
    personas.find((persona) => persona.id === personaId && persona.is_default) ??
    null;

  if (exactMatch) {
    return exactMatch;
  }

  throw new Error("Default persona RPC did not return the promoted persona.");
}

export async function duplicatePersona(
  supabase: DatabaseClient,
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
    .select(personaSelect)
    .single();

  if (error) throw error;
  return castRow<UserPersonaRecord>(data);
}

export async function deletePersona(
  supabase: DatabaseClient,
  userId: string,
  personaId: string,
) {
  const { error } = await supabase.rpc("delete_persona_and_reassign", {
    p_user_id: userId,
    p_persona_id: personaId,
  });

  if (error) throw error;
}
