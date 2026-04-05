"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import {
  deletePersona,
  duplicatePersona,
  setDefaultPersona,
  upsertPersona,
} from "@/lib/data/personas";

export async function savePersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/app/personas?reason=name");
  }

  const persona = await upsertPersona(supabase, user.id, {
    id: String(formData.get("id") ?? "").trim() || undefined,
    name,
    identity: String(formData.get("identity") ?? ""),
    backstory: String(formData.get("backstory") ?? ""),
    voice_style: String(formData.get("voice_style") ?? ""),
    goals: String(formData.get("goals") ?? ""),
    boundaries: String(formData.get("boundaries") ?? ""),
    private_notes: String(formData.get("private_notes") ?? ""),
    is_default: formData.get("is_default") === "on",
  });

  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect(`/app/personas?edit=${persona.id}&saved=1`);
}

export async function setDefaultPersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const personaId = String(formData.get("personaId") ?? "").trim();
  if (!personaId) {
    throw new Error("Persona id is required.");
  }

  await setDefaultPersona(supabase, user.id, personaId);
  revalidatePath("/app");
  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect("/app/personas?defaulted=1");
}

export async function duplicatePersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const personaId = String(formData.get("personaId") ?? "").trim();
  if (!personaId) {
    throw new Error("Persona id is required.");
  }

  const persona = await duplicatePersona(supabase, user.id, personaId);
  revalidatePath("/app/personas");
  redirect(`/app/personas?edit=${persona.id}&duplicated=1`);
}

export async function deletePersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const personaId = String(formData.get("personaId") ?? "").trim();
  if (!personaId) {
    throw new Error("Persona id is required.");
  }

  await deletePersona(supabase, user.id, personaId);
  revalidatePath("/app");
  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect("/app/personas?deleted=1");
}
