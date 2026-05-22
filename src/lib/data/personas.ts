import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type { PersonaUsageSummary, UserPersonaRecord } from "@/lib/types";
import { z } from "zod";

const personaRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  identity: z.string(),
  backstory: z.string(),
  voice_style: z.string(),
  goals: z.string(),
  boundaries: z.string(),
  private_notes: z.string(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

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

function normalizePersona(value: unknown, label = "Persona") {
  return parseRow(value, personaRecordSchema, label) as UserPersonaRecord;
}

function normalizePersonas(value: unknown, label = "Personas") {
  return parseRows(value, personaRecordSchema, label) as UserPersonaRecord[];
}

export async function listPersonas(supabase: DatabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_personas")
    .select(personaSelect)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return normalizePersonas(data ?? [], "Persona list");
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

  if (error) {
    throw error;
  }

  return data ? normalizePersona(data) : null;
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

  if (error) {
    throw error;
  }

  return data ? normalizePersona(data, "Default persona") : null;
}

export async function upsertPersona(
  supabase: DatabaseClient,
  userId: string,
  payload: Partial<UserPersonaRecord> & { id?: string; name: string },
) {
  const shouldSetDefault = Boolean(payload.is_default);
  const next = {
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
  if (error) {
    throw error;
  }

  const persona = normalizePersona(data, "Saved persona");
  return shouldSetDefault ? setDefaultPersona(supabase, userId, persona.id) : persona;
}

export async function setDefaultPersona(
  supabase: DatabaseClient,
  _userId: string,
  personaId: string,
) {
  const { data, error } = await supabase.rpc("set_default_persona", {
    target_persona_id: personaId,
  });

  if (error) {
    throw error;
  }

  return normalizePersona(data, "Promoted default persona");
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

  if (error) {
    throw error;
  }

  return normalizePersona(data, "Duplicated persona");
}

export async function listPersonaUsage(
  supabase: DatabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("persona_id, status")
    .eq("user_id", userId)
    .not("persona_id", "is", null);

  if (error) {
    throw error;
  }

  const counts = new Map<string, PersonaUsageSummary>();
  for (const row of data ?? []) {
    if (!row.persona_id) {
      continue;
    }

    const current = counts.get(row.persona_id) ?? {
      personaId: row.persona_id,
      totalThreads: 0,
      activeThreads: 0,
    };
    current.totalThreads += 1;
    if (row.status === "active") {
      current.activeThreads += 1;
    }
    counts.set(row.persona_id, current);
  }

  return [...counts.values()].sort((left, right) =>
    right.totalThreads - left.totalThreads || right.activeThreads - left.activeThreads,
  );
}

export async function deletePersona(
  supabase: DatabaseClient,
  userId: string,
  personaId: string,
) {
  const persona = await getPersona(supabase, userId, personaId);
  if (!persona) {
    return;
  }

  const personas = await listPersonas(supabase, userId);
  const replacement =
    personas.find((entry) => entry.id !== personaId && entry.is_default) ??
    personas.find((entry) => entry.id !== personaId) ??
    null;

  if (replacement) {
    const { error: reassignError } = await supabase
      .from("chat_threads")
      .update({ persona_id: replacement.id })
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (reassignError) {
      throw reassignError;
    }

    if (persona.is_default && !replacement.is_default) {
      await setDefaultPersona(supabase, userId, replacement.id);
    }
  }

  const { error } = await supabase
    .from("user_personas")
    .delete()
    .eq("user_id", userId)
    .eq("id", personaId);

  if (error) {
    throw error;
  }
}
