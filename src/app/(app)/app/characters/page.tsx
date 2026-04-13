import Link from "next/link";
import Image from "next/image";
import { Plus, WandSparkles } from "lucide-react";
import { requireAllowedUser } from "@/lib/auth";
import { resolveCharacterPortraitUrl } from "@/lib/characters/portraits";
import { CharacterStudioForm } from "@/components/characters/character-studio-form";
import { getCharacterBundle, listCharacters } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { getDefaultPersona, listPersonas } from "@/lib/data/personas";
import {
  deleteCharacterAction,
  regenerateCharacterPortraitAction,
  saveCharacterAction,
  startThreadAction,
} from "@/app/(app)/app/characters/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { SubmitButton } from "@/components/forms/submit-button";

type ThreadSetupStep = {
  id: "persona" | "provider";
  label: string;
  ctaLabel: string;
  href: string;
  ready: boolean;
  detail: string;
};

function buildThreadSetupSteps(options: {
  personaCount: number;
  hasDefaultPersona: boolean;
  hasUsableConnection: boolean;
  connectionsCount: number;
}) {
  const steps: ThreadSetupStep[] = [
    {
      id: "persona",
      label: "Persona library",
      ctaLabel: options.personaCount > 0 ? "Persona ready" : "Create persona",
      href: "/app/personas?reason=default",
      ready: options.personaCount > 0,
      detail:
        options.personaCount > 0
          ? options.hasDefaultPersona
            ? "Pick the persona you want per thread. The default is just the starting selection."
            : "You can choose a persona when the thread starts, even without a global default."
          : "Create at least one persona before you open a new scene.",
    },
    {
      id: "provider",
      label: "Provider lane",
      ctaLabel:
        options.hasUsableConnection || options.connectionsCount > 0
          ? "Refresh models"
          : "Configure provider",
      href: "/app/settings/providers?reason=connection",
      ready: options.hasUsableConnection,
      detail: options.hasUsableConnection
        ? "A tested model is ready for thread creation."
        : options.connectionsCount > 0
          ? "The lane exists, but it still needs a successful test and model refresh."
          : "Add a provider, test it, then refresh the available models.",
    },
  ];

  return {
    steps,
    missing: steps.filter((step) => !step.ready),
  };
}

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAllowedUser();
  const params = await searchParams;
  const [characters, connections, personas, defaultPersona] = await Promise.all([
    listCharacters(supabase, user.id),
    listConnections(supabase, user.id),
    listPersonas(supabase, user.id),
    getDefaultPersona(supabase, user.id),
  ]);
  const editId = typeof params.edit === "string" ? params.edit : null;
  const editing = editId ? await getCharacterBundle(supabase, user.id, editId) : null;
  const editingPortraitUrl = editing
    ? await resolveCharacterPortraitUrl(supabase, editing.character.portrait_path)
    : null;
  const reason = typeof params.reason === "string" ? params.reason : null;
  const hasUsableConnection = connections.some(
    (connection) => connection.enabled && connection.model_cache.length > 0,
  );
  const threadSetup = buildThreadSetupSteps({
    personaCount: personas.length,
    hasDefaultPersona: Boolean(defaultPersona),
    hasUsableConnection,
    connectionsCount: connections.length,
  });
  const canStartThread = threadSetup.missing.length === 0;
  const primarySetupStep = threadSetup.missing[0] ?? null;
  const characterCards = await Promise.all(
    characters.map(async (character) => ({
      ...character,
      portraitUrl: await resolveCharacterPortraitUrl(supabase, character.portrait_path),
    })),
  );

  return (
    <div className="space-y-8" data-testid="characters-page">
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

          {!canStartThread ? (
            <div className="w-full max-w-md rounded-[1.6rem] border border-border bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                    Thread launch checklist
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Finish these two prerequisites once, then every saved character can start a thread.
                  </p>
                </div>
                {primarySetupStep ? (
                  <Link
                    href={primarySetupStep.href}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {threadSetup.missing.length > 1 ? "Finish setup" : primarySetupStep.ctaLabel}
                    <WandSparkles className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                {threadSetup.steps.map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className="flex items-start justify-between gap-4 rounded-[1.1rem] border border-border bg-paper px-4 py-3 transition hover:border-brand"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      <p className="mt-1 text-xs leading-6 text-ink-soft">{step.detail}</p>
                    </div>
                    <span
                      className={
                        step.ready
                          ? "rounded-full bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400"
                          : "rounded-full bg-amber-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400"
                      }
                    >
                      {step.ready ? "ready" : "needed"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {reason === "name" ? (
          <div className="mt-5 rounded-2xl bg-amber-950/40 px-4 py-3 text-sm text-amber-400">
            Every character sheet needs a name before it can be saved or reused inside threads.
          </div>
        ) : null}
        {params.saved === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Character saved. You can start a thread now or keep shaping the voice.
          </div>
        ) : null}
        {params.deleted === "1" ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
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
            portraitPreviewUrl={editingPortraitUrl}
            regeneratePortraitAction={regenerateCharacterPortraitAction}
            saved={params.saved === "1"}
          />
        </section>

        <section className="space-y-4">
          {characterCards.length ? (
            characterCards.map((character) => (
              <article key={character.id} className="paper-panel rounded-[2rem] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                      Character
                    </p>
                    <h3 className="mt-2 font-serif text-3xl text-foreground">
                      {character.name}
                    </h3>
                    {character.core_persona ? (
                      <p className="mt-2 text-sm font-semibold text-brand">{character.core_persona.slice(0, 80)}</p>
                    ) : null}
                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-ink-soft">
                      {character.story ||
                        character.core_persona ||
                        character.greeting}
                    </p>
                  </div>
                  {character.portraitUrl ? (
                    <Image
                      src={character.portraitUrl}
                      alt={`${character.name} portrait`}
                      width={80}
                      height={80}
                      className="h-20 w-20 shrink-0 rounded-[1.4rem] border border-border object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.4rem] border border-dashed border-border bg-white/5">
                      <Plus className="h-5 w-5 text-brand" />
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/app/characters?edit=${character.id}`}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                  >
                    Edit sheet
                  </Link>

                  {canStartThread ? (
                    <form action={startThreadAction} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="characterId" value={character.id} />
                      <label className="min-w-[13rem] flex-1">
                        <span className="sr-only">Persona for this thread</span>
                        <select
                          name="personaId"
                          defaultValue={defaultPersona?.id ?? personas[0]?.id ?? ""}
                          className="w-full rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-foreground outline-none transition focus:border-brand"
                        >
                          {personas.map((persona) => (
                            <option key={persona.id} value={persona.id}>
                              {persona.name}
                              {persona.is_default ? " (default)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <SubmitButton className="px-4 py-2 text-sm">
                        Start thread
                      </SubmitButton>
                    </form>
                  ) : primarySetupStep ? (
                    <Link
                      href={primarySetupStep.href}
                      className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong"
                    >
                      {threadSetup.missing.length > 1 ? "Finish setup" : primarySetupStep.ctaLabel}
                    </Link>
                  ) : null}

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

                {!canStartThread ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {threadSetup.missing.map((step) => (
                      <Link
                        key={`${character.id}-${step.id}`}
                        href={step.href}
                        className="rounded-full border border-border bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
                      >
                        {step.ctaLabel}
                      </Link>
                    ))}
                  </div>
                ) : null}
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
