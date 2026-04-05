import Link from "next/link";
import { Plus, WandSparkles } from "lucide-react";
import { requireAllowedUser } from "@/lib/auth";
import { CharacterStudioForm } from "@/components/characters/character-studio-form";
import { getCharacterBundle, listCharacters } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { getDefaultPersona } from "@/lib/data/personas";
import {
  deleteCharacterAction,
  saveCharacterAction,
  startThreadAction,
} from "@/app/(app)/app/characters/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { SubmitButton } from "@/components/forms/submit-button";

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAllowedUser();
  const params = await searchParams;
  const characters = await listCharacters(supabase, user.id);
  const connections = await listConnections(supabase, user.id);
  const defaultPersona = await getDefaultPersona(supabase, user.id);
  const editId = typeof params.edit === "string" ? params.edit : null;
  const editing = editId ? await getCharacterBundle(supabase, user.id, editId) : null;
  const reason = typeof params.reason === "string" ? params.reason : null;
  const hasUsableConnection = connections.some(
    (connection) => connection.enabled && connection.model_cache.length > 0,
  );

  return (
    <div className="space-y-8">
      <section className="paper-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">
              Character studio
            </p>
            <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground">
              Build the voice before you ask it to improvise.
            </h1>
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              Characters now carry a real profile, deeper definition rules, suggested starters,
              and structured example conversations for stronger roleplay consistency.
            </p>
          </div>

          {!defaultPersona ? (
            <Link
              href="/app/personas"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Create a default persona first
              <WandSparkles suppressHydrationWarning className="h-4 w-4" />
            </Link>
          ) : !hasUsableConnection ? (
            <Link
              href="/app/settings/providers"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Configure a provider first
              <WandSparkles suppressHydrationWarning className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {reason === "name" ? (
          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Every character sheet needs a name before it can be saved or reused inside threads.
          </div>
        ) : null}
        {params.saved === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Character saved. You can start a thread now or keep shaping the voice.
          </div>
        ) : null}
        {params.deleted === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Character removed from the studio.
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="paper-panel rounded-[2rem] p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">
                Builder
              </p>
              <h2 className="mt-2 font-serif text-3xl text-foreground">
                {editing ? `Editing ${editing.character.name}` : "Create a new character"}
              </h2>
            </div>
            {editing ? (
              <Link
                href="/app/characters"
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                New sheet
              </Link>
            ) : null}
          </div>

          <CharacterStudioForm
            editing={editing}
            action={saveCharacterAction}
            saved={params.saved === "1"}
          />
        </section>

        <section className="space-y-4">
          {characters.length ? (
            characters.map((character) => (
              <article key={character.id} className="paper-panel rounded-[2rem] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                      Character
                    </p>
                    <h3 className="mt-2 font-serif text-3xl text-foreground">
                      {character.name}
                    </h3>
                    {character.tagline ? (
                      <p className="mt-2 text-sm font-semibold text-brand">{character.tagline}</p>
                    ) : null}
                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-ink-soft">
                      {character.short_description ||
                        character.core_persona ||
                        character.scenario_seed ||
                        character.greeting}
                    </p>
                  </div>
                  <Plus suppressHydrationWarning className="h-5 w-5 text-brand" />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/app/characters?edit=${character.id}`}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                  >
                    Edit sheet
                  </Link>

                  <form action={startThreadAction}>
                    <input type="hidden" name="characterId" value={character.id} />
                    <SubmitButton
                      className="px-4 py-2 text-sm"
                      disabled={!defaultPersona || !hasUsableConnection}
                    >
                      Start thread
                    </SubmitButton>
                  </form>

                  <form action={deleteCharacterAction}>
                    <input type="hidden" name="characterId" value={character.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Delete this character and every thread attached to it?"
                      className="border border-[#7f4a2e] bg-[#241d16] px-4 py-2 text-sm text-[#e8bda2] hover:bg-[#2d231b]"
                    >
                      Delete character
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-ink-soft">
              No characters yet. Start with one clear persona, one situation, and
              one way of speaking. Fantasia will take it from there.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
