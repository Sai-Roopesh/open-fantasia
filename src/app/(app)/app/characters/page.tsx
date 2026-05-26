import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
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
      label: "Persona",
      ctaLabel: options.personaCount > 0 ? "Ready" : "Create persona",
      href: "/app/personas?reason=default",
      ready: options.personaCount > 0,
      detail: options.personaCount > 0
        ? options.hasDefaultPersona ? "Default persona set." : "Choose one when starting a thread."
        : "Create at least one persona.",
    },
    {
      id: "provider",
      label: "Provider",
      ctaLabel: options.hasUsableConnection || options.connectionsCount > 0 ? "Refresh models" : "Configure provider",
      href: "/app/settings/providers?reason=connection",
      ready: options.hasUsableConnection,
      detail: options.hasUsableConnection
        ? "A tested model is ready."
        : options.connectionsCount > 0 ? "Needs test and model refresh." : "Add a provider first.",
    },
  ];

  return { steps, missing: steps.filter((step) => !step.ready) };
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
  const enabledConnections = connections.filter((c) => c.enabled && c.model_cache.length > 0);
  const allModels = enabledConnections.flatMap((conn) =>
    conn.model_cache.map((model) => ({
      connectionId: conn.id,
      modelId: model.id,
      label: `${conn.label} — ${model.name || model.id}`,
    }))
  );
  const brainModels = allModels.filter((m) => {
    const conn = enabledConnections.find((c) => c.id === m.connectionId);
    return conn && conn.provider !== "deepseek";
  });

  const defaultUsableConnection = enabledConnections.find(
    (c) => c.default_model_id && c.model_cache.some((m) => m.id === c.default_model_id)
  );
  const defaultModelVal = defaultUsableConnection
    ? `${defaultUsableConnection.id}:${defaultUsableConnection.default_model_id}`
    : allModels[0]
      ? `${allModels[0].connectionId}:${allModels[0].modelId}`
      : "";

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
    <div className="space-y-4" data-testid="characters-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-on-surface">Characters</h1>
        {editing && (
          <Link href="/app/characters" className="text-xs font-semibold text-primary-container">
            + New
          </Link>
        )}
      </div>

      {/* Banners */}
      {reason && (
        <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
          {reason === "name" ? "Every character needs a name before saving." : reason}
        </div>
      )}
      {params.saved === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Character saved.
        </div>
      )}
      {params.deleted === "1" && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Character removed.
        </div>
      )}

      {/* Thread launch prerequisites */}
      {!canStartThread && (
        <div className="rounded-lg border border-border-subtle bg-background-front p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Thread launch checklist
          </p>
          <div className="mt-2 space-y-2">
            {threadSetup.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className="flex items-center justify-between rounded border border-border-subtle bg-surface-container-low px-3 py-2 hover:border-primary-container/40"
              >
                <div>
                  <p className="text-sm font-medium text-on-surface">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${
                    step.ready
                      ? "border-status-success/30 bg-status-success/10 text-status-success"
                      : "border-status-warning/30 bg-status-warning/10 text-status-warning"
                  }`}
                >
                  {step.ready ? "ready" : "needed"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Character builder form */}
      <section className="rounded-lg border border-border-subtle bg-background-front p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {editing ? `Editing ${editing.character.name}` : "New character"}
        </p>
        <CharacterStudioForm
          editing={editing}
          action={saveCharacterAction}
          portraitPreviewUrl={editingPortraitUrl}
          regeneratePortraitAction={regenerateCharacterPortraitAction}
          saved={params.saved === "1"}
        />
      </section>

      {/* Character cards */}
      <section className="space-y-2">
        {characterCards.length ? (
          characterCards.map((character) => (
            <article
              key={character.id}
              className="rounded-lg border border-border-subtle bg-background-front p-4"
            >
              <div className="flex items-start gap-3">
                {/* Portrait */}
                {character.portraitUrl ? (
                  <Image
                    src={character.portraitUrl}
                    alt={`${character.name} portrait`}
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg border border-border-subtle object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface-container">
                    <Plus className="h-4 w-4 text-primary-container" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">{character.name}</p>
                  {character.core_persona && (
                    <p className="truncate text-xs font-medium text-primary-container">
                      {character.core_persona.slice(0, 80)}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {character.story || character.core_persona || character.greeting}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/app/characters?edit=${character.id}`}
                  className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface"
                >
                  Edit
                </Link>

                {canStartThread ? (
                  <form action={startThreadAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="characterId" value={character.id} />
                    
                    <label>
                      <span className="sr-only">Persona for this thread</span>
                      <select
                        name="personaId"
                        defaultValue={defaultPersona?.id ?? ""}
                        required
                        className="rounded border border-border-subtle bg-surface-container px-2 py-1 text-xs text-on-surface outline-none focus:border-primary-container"
                      >
                        {!defaultPersona && (
                          <option value="" disabled>Choose persona</option>
                        )}
                        {personas.map((persona) => (
                          <option key={persona.id} value={persona.id}>
                            {persona.name}
                            {persona.is_default ? " (default)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    {allModels.length > 0 && (
                      <label>
                        <span className="sr-only">Chat Model</span>
                        <select
                          name="modelSelect"
                          defaultValue={defaultModelVal}
                          required
                          className="rounded border border-border-subtle bg-surface-container px-2 py-1 text-xs text-on-surface outline-none focus:border-primary-container"
                        >
                          {allModels.map((m, idx) => (
                            <option key={idx} value={`${m.connectionId}:${m.modelId}`}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {brainModels.length > 0 && (
                      <label>
                        <span className="sr-only">Brain Model (HCE)</span>
                        <select
                          name="brainModelSelect"
                          defaultValue=""
                          className="rounded border border-border-subtle bg-surface-container px-2 py-1 text-xs text-on-surface outline-none focus:border-primary-container"
                        >
                          <option value="">Default (Inherit Chat Model)</option>
                          {brainModels.map((m, idx) => (
                            <option key={idx} value={`${m.connectionId}:${m.modelId}`}>
                              HCE: {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <SubmitButton className="rounded bg-primary-container px-2 py-1 text-xs font-semibold text-on-primary-container">
                      Start thread
                    </SubmitButton>
                  </form>
                ) : primarySetupStep ? (
                  <Link
                    href={primarySetupStep.href}
                    className="rounded bg-primary-container/10 px-2 py-1 text-xs font-semibold text-primary-container"
                  >
                    {threadSetup.missing.length > 1 ? "Finish setup" : primarySetupStep.ctaLabel}
                  </Link>
                ) : null}

                <form action={deleteCharacterAction}>
                  <input type="hidden" name="characterId" value={character.id} />
                  <ConfirmSubmitButton
                    confirmMessage="Delete this character and every thread attached to it?"
                    className="rounded bg-status-critical/10 border border-status-critical/30 px-2 py-1 text-xs font-semibold text-status-critical"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
            No characters yet. Build one above.
          </div>
        )}
      </section>
    </div>
  );
}
