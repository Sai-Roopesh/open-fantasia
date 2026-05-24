import Link from "next/link";
import { requireAllowedUser } from "@/lib/auth";
import {
  deletePersonaAction,
  duplicatePersonaAction,
  savePersonaAction,
  setDefaultPersonaAction,
} from "@/app/(app)/app/personas/actions";
import {
  listPersonas,
  listPersonaUsage,
} from "@/lib/data/personas";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { PersonaStudioForm } from "@/components/personas/persona-studio-form";

function reasonCopy(reason: string) {
  if (reason === "name") return "Give the persona a name before saving.";
  if (reason === "default") return "Create at least one persona before starting threads.";
  return reason;
}

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAllowedUser();
  const params = await searchParams;
  const personas = await listPersonas(supabase, user.id);
  const usage = await listPersonaUsage(supabase, user.id).catch(() => []);
  const editId = typeof params.edit === "string" ? params.edit : null;
  const editing = editId
    ? personas.find((persona) => persona.id === editId) ?? null
    : null;
  const reason = typeof params.reason === "string" ? params.reason : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-on-surface">Personas</h1>
        {editing && (
          <Link href="/app/personas" className="text-xs font-semibold text-primary-container">
            + New
          </Link>
        )}
      </div>

      {/* Banners */}
      {reason && (
        <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
          {reasonCopy(reason)}
        </div>
      )}
      {params.saved === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Persona saved.
        </div>
      )}
      {params.defaulted === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Default persona updated.
        </div>
      )}
      {params.duplicated === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Persona duplicated.
        </div>
      )}
      {params.deleted === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Persona removed.
        </div>
      )}

      {/* Builder form */}
      <section className="rounded-lg border border-border-subtle bg-background-front p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {editing ? `Editing ${editing.name}` : "New persona"}
        </p>
        <PersonaStudioForm
          editing={editing}
          personaCount={personas.length}
          action={savePersonaAction}
          saved={params.saved === "1"}
        />
      </section>

      {/* Persona cards */}
      <section className="space-y-2">
        {personas.length ? (
          personas.map((persona) => {
            const summary = usage.find((entry) => entry.personaId === persona.id);
            return (
              <article
                key={persona.id}
                className="rounded-lg border border-border-subtle bg-background-front p-4"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-on-surface">{persona.name}</p>
                  {persona.is_default && (
                    <span className="rounded border border-primary-container/30 bg-primary-container/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-primary-container">
                      default
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {persona.identity || persona.voice_style || persona.goals || "No profile notes yet."}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {summary?.totalThreads ?? 0} thread{summary?.totalThreads === 1 ? "" : "s"}
                  {summary?.activeThreads ? ` · ${summary.activeThreads} active` : ""}
                </p>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/app/personas?edit=${persona.id}`}
                    className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface"
                  >
                    Edit
                  </Link>

                  {!persona.is_default && (
                    <form action={setDefaultPersonaAction}>
                      <input type="hidden" name="personaId" value={persona.id} />
                      <button
                        type="submit"
                        className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface"
                      >
                        Make default
                      </button>
                    </form>
                  )}

                  <form action={duplicatePersonaAction}>
                    <input type="hidden" name="personaId" value={persona.id} />
                    <button
                      type="submit"
                      className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface"
                    >
                      Duplicate
                    </button>
                  </form>

                  <form action={deletePersonaAction}>
                    <input type="hidden" name="personaId" value={persona.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Delete this persona? Threads using it will be reassigned if another persona exists."
                      className="rounded bg-status-critical/10 border border-status-critical/30 px-2 py-1 text-xs font-semibold text-status-critical"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
            No personas yet. Create one above.
          </div>
        )}
      </section>
    </div>
  );
}
