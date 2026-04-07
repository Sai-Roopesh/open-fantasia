import Link from "next/link";
import { requireAllowedUser } from "@/lib/auth";
import {
  deletePersonaAction,
  duplicatePersonaAction,
  savePersonaAction,
  setDefaultPersonaAction,
} from "@/app/(app)/app/personas/actions";
import {
  getPersona,
  listPersonas,
  listPersonaUsage,
} from "@/lib/data/personas";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { PersonaStudioForm } from "@/components/personas/persona-studio-form";

function reasonCopy(reason: string) {
  if (reason === "name") {
    return "Give the persona a name so it is recognizable when you attach it to a thread.";
  }
  if (reason === "default") {
    return "Choose a default persona before starting a new thread, or keep only one persona in the library so Fantasia can infer it.";
  }
  return reason;
}

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAllowedUser();
  const params = await searchParams;
  const [personas, usage] = await Promise.all([
    listPersonas(supabase, user.id),
    listPersonaUsage(supabase, user.id),
  ]);
  const editId = typeof params.edit === "string" ? params.edit : null;
  const editing = editId ? await getPersona(supabase, user.id, editId) : null;
  const reason = typeof params.reason === "string" ? params.reason : null;

  return (
    <div className="space-y-8">
      <section className="paper-panel rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Persona library</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground">
          Define who the user is before the story asks for a choice.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">
          Personas are reusable self-profiles for roleplay. Keep one default for new threads, but
          keep alternates nearby when the same character needs a different version of you.
        </p>

        {reason ? (
          <div className="mt-5 rounded-2xl bg-amber-950/40 px-4 py-3 text-sm text-amber-400">
            {reasonCopy(reason)}
          </div>
        ) : null}
        {params.saved === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Persona saved. New threads can use it immediately.
          </div>
        ) : null}
        {params.defaulted === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Default persona updated.
          </div>
        ) : null}
        {params.duplicated === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Persona duplicated. Adjust it and save when the new version feels distinct.
          </div>
        ) : null}
        {params.deleted === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Persona removed from the library.
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="paper-panel rounded-[2rem] p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Builder</p>
              <h2 className="mt-2 font-serif text-3xl text-foreground">
                {editing ? `Editing ${editing.name}` : "Create a persona"}
              </h2>
            </div>
            {editing ? (
              <Link
                href="/app/personas"
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                New persona
              </Link>
            ) : null}
          </div>

          <PersonaStudioForm
            editing={editing}
            personaCount={personas.length}
            action={savePersonaAction}
            saved={params.saved === "1"}
          />
        </section>

        <section className="space-y-4">
          {personas.length ? (
            personas.map((persona) => {
              const summary = usage.find((entry) => entry.personaId === persona.id);

              return (
                <article key={persona.id} className="paper-panel rounded-[2rem] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-serif text-3xl text-foreground">{persona.name}</h3>
                        {persona.is_default ? (
                          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                            default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 line-clamp-4 text-sm leading-7 text-ink-soft">
                        {persona.identity || persona.voice_style || persona.goals || "No profile notes yet."}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-soft">
                        {summary?.totalThreads ?? 0} thread{summary?.totalThreads === 1 ? "" : "s"} using this persona
                        {summary?.activeThreads ? ` • ${summary.activeThreads} active` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/app/personas?edit=${persona.id}`}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                    >
                      Edit persona
                    </Link>

                    {!persona.is_default ? (
                      <form action={setDefaultPersonaAction}>
                        <input type="hidden" name="personaId" value={persona.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                        >
                          Make default
                        </button>
                      </form>
                    ) : null}

                    <form action={duplicatePersonaAction}>
                      <input type="hidden" name="personaId" value={persona.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                      >
                        Duplicate
                      </button>
                    </form>

                    <form action={deletePersonaAction}>
                      <input type="hidden" name="personaId" value={persona.id} />
                      <ConfirmSubmitButton
                        confirmMessage="Delete this persona? Threads using it will be reassigned if another persona exists."
                        className="border border-red-900/40 bg-red-950/40 px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-ink-soft">
              No personas yet. Create one default self-profile so threads know who the user is
              inside the scene before the first message lands.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
