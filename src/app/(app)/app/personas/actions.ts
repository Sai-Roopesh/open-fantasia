"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import {
  emptyPersonaFormState,
  type PersonaFormState,
} from "@/components/personas/persona-form-state";
import {
  deletePersona,
  duplicatePersona,
  setDefaultPersona,
  upsertPersona,
} from "@/lib/data/personas";
import {
  parseFormBoolean,
  personaCommandSchema,
  savePersonaCommandSchema,
} from "@/lib/validation";

export async function savePersonaAction(
  _previousState: PersonaFormState,
  formData: FormData,
): Promise<PersonaFormState> {
  const { supabase, user } = await requireAllowedUser();
  const parsed = savePersonaCommandSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim(),
    identity: String(formData.get("identity") ?? ""),
    backstory: String(formData.get("backstory") ?? ""),
    voice_style: String(formData.get("voice_style") ?? ""),
    goals: String(formData.get("goals") ?? ""),
    boundaries: String(formData.get("boundaries") ?? ""),
    private_notes: String(formData.get("private_notes") ?? ""),
    is_default: parseFormBoolean(formData.get("is_default")),
  });

  if (!parsed.success) {
    return {
      ...emptyPersonaFormState,
      fieldErrors: {
        name: "Give the persona a name so it is recognizable when you attach it to a thread.",
      },
    };
  }

  let persona;
  try {
    persona = await upsertPersona(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      ...emptyPersonaFormState,
      formError:
        error instanceof Error
          ? error.message
          : "Fantasia could not save this persona right now.",
    };
  }

  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect(`/app/personas?edit=${persona.id}&saved=1`);
}

export async function setDefaultPersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = personaCommandSchema.safeParse({
    personaId: String(formData.get("personaId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Persona id is required.");
  }

  await setDefaultPersona(supabase, user.id, parsed.data.personaId);
  revalidatePath("/app");
  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect("/app/personas?defaulted=1");
}

export async function duplicatePersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = personaCommandSchema.safeParse({
    personaId: String(formData.get("personaId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Persona id is required.");
  }

  const persona = await duplicatePersona(supabase, user.id, parsed.data.personaId);
  revalidatePath("/app/personas");
  redirect(`/app/personas?edit=${persona.id}&duplicated=1`);
}

export async function deletePersonaAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = personaCommandSchema.safeParse({
    personaId: String(formData.get("personaId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Persona id is required.");
  }

  await deletePersona(supabase, user.id, parsed.data.personaId);
  revalidatePath("/app");
  revalidatePath("/app/personas");
  revalidatePath("/app/characters");
  redirect("/app/personas?deleted=1");
}
