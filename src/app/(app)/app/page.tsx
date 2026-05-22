import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { requireAllowedUser } from "@/lib/auth";
import { listCharacters } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { getDefaultPersona } from "@/lib/data/personas";
import { listThreadItems } from "@/lib/data/threads";
import type { DashboardReadiness } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function buildReadiness(args: {
  hasDefaultPersona: boolean;
  hasProvider: boolean;
  hasHealthyProvider: boolean;
  hasRefreshedModels: boolean;
  hasCharacter: boolean;
  hasThread: boolean;
}) {
  const ordered = [
    {
      key: "persona",
      label: "Create one default persona",
      done: args.hasDefaultPersona,
      href: "/app/personas",
    },
    {
      key: "provider",
      label: "Save at least one provider lane",
      done: args.hasProvider,
      href: "/app/settings/providers",
    },
    {
      key: "health",
      label: "Verify a provider connection",
      done: args.hasHealthyProvider,
      href: "/app/settings/providers",
    },
    {
      key: "models",
      label: "Refresh available models",
      done: args.hasRefreshedModels,
      href: "/app/settings/providers",
    },
    {
      key: "character",
      label: "Build your first character sheet",
      done: args.hasCharacter,
      href: "/app/characters",
    },
    {
      key: "thread",
      label: "Start your first live thread",
      done: args.hasThread,
      href: "/app/characters",
    },
  ];

  const next =
    ordered.find((step) => !step.done) ?? ordered[ordered.length - 1];
  const completedSteps = ordered.filter((step) => step.done).length;

  return {
    hasDefaultPersona: args.hasDefaultPersona,
    hasProvider: args.hasProvider,
    hasHealthyProvider: args.hasHealthyProvider,
    hasRefreshedModels: args.hasRefreshedModels,
    hasCharacter: args.hasCharacter,
    hasThread: args.hasThread,
    completedSteps,
    totalSteps: ordered.length,
    nextHref: next.href,
    nextLabel:
      completedSteps === ordered.length
        ? "Open your thread library"
        : next.label,
  } satisfies DashboardReadiness;
}

export default async function AppIndexPage() {
  const { supabase, user } = await requireAllowedUser();

  const [defaultPersona, connections, characters, threads] = await Promise.all([
    getDefaultPersona(supabase, user.id),
    listConnections(supabase, user.id),
    listCharacters(supabase, user.id),
    listThreadItems(supabase, user.id, { status: "all" }),
  ]);

  const recentThreads = threads.slice(0, 4);
  const activeThreads = threads.filter((thread) => thread.status === "active");
  const latestCharacter =
    characters.find((character) => character.id === activeThreads[0]?.character_id) ??
    characters[0] ??
    null;

  const healthyProviders = connections.filter(
    (connection) => connection.health_status === "healthy",
  );
  const refreshedProviders = connections.filter(
    (connection) => connection.last_model_refresh_at && connection.model_cache.length > 0,
  );

  const readiness = buildReadiness({
    hasDefaultPersona: Boolean(defaultPersona),
    hasProvider: connections.length > 0,
    hasHealthyProvider: healthyProviders.length > 0,
    hasRefreshedModels: refreshedProviders.length > 0,
    hasCharacter: characters.length > 0,
    hasThread: threads.length > 0,
  });

  const checklist = [
    {
      label: "Default persona",
      done: readiness.hasDefaultPersona,
      detail: defaultPersona
        ? `${defaultPersona.name} is ready to speak for you.`
        : "Threads need a stable user identity before they start.",
    },
    {
      label: "Provider lane",
      done: readiness.hasProvider,
      detail: connections.length
        ? `${connections.length} saved lane${connections.length === 1 ? "" : "s"} in your workspace.`
        : "Add one provider connection so Fantasia has somewhere to send chat turns.",
    },
    {
      label: "Connection health",
      done: readiness.hasHealthyProvider,
      detail: healthyProviders.length
        ? `${healthyProviders.length} lane${healthyProviders.length === 1 ? "" : "s"} verified.`
        : "Run a connection test so you know the current key and base URL actually work.",
    },
    {
      label: "Models refreshed",
      done: readiness.hasRefreshedModels,
      detail: refreshedProviders.length
        ? `${refreshedProviders.length} lane${refreshedProviders.length === 1 ? "" : "s"} already have a switchable model list.`
        : "Refresh at least one lane so thread model switching becomes usable.",
    },
    {
      label: "Character sheet",
      done: readiness.hasCharacter,
      detail: latestCharacter
        ? `${latestCharacter.name} is the latest sheet in your library.`
        : "Build one voice, one situation, and one scene seed before you improvise.",
    },
    {
      label: "Live thread",
      done: readiness.hasThread,
      detail: activeThreads.length
        ? `${activeThreads.length} active thread${activeThreads.length === 1 ? "" : "s"} waiting for the next move.`
        : "Start one thread so the system can begin tracking continuity.",
    },
  ];

  return (
    <div className="space-y-8" data-testid="workspace-dashboard">
      <section className="overflow-hidden rounded-[2.4rem] border border-border bg-[#1d130e] text-white shadow-[0_30px_80px_rgba(32,17,10,0.18)]">
        <div className="grid gap-10 px-8 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-12">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-white/58">
              Private workspace home
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.95] md:text-6xl">
              Keep the whole roleplay rig in one calm room.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-white/72 md:text-base">
              Fantasia works best when setup is obvious: define your persona, prove a provider,
              refresh the models you trust, then drop into a thread with a character that already
              knows how to speak.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={readiness.completedSteps === readiness.totalSteps ? "/app/threads" : readiness.nextHref}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
              >
                {readiness.nextLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/threads"
                className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Open thread library
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                  Setup progress
                </p>
                <p className="mt-2 font-serif text-4xl">
                  {readiness.completedSteps}/{readiness.totalSteps}
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-[#f0cba9]" />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand"
                style={{
                  width: `${(readiness.completedSteps / readiness.totalSteps) * 100}%`,
                }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.4rem] border border-white/10 bg-black/10 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-[#f0cba9]" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-white/45" />
                    )}
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                  </div>
                  <p className="mt-2 pl-7 text-xs leading-6 text-white/62">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="paper-panel rounded-[2rem] p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Next move</p>
            <h2 className="mt-3 font-serif text-4xl text-foreground">
              {readiness.completedSteps === readiness.totalSteps
                ? "Everything critical is wired."
                : "Your workspace is almost there."}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-soft">
              {readiness.completedSteps === readiness.totalSteps
                ? "You can jump straight into the thread library, continue the latest scene, or tighten one of your character sheets."
                : "The dashboard will keep pointing you at the highest-leverage setup step until the whole roleplay loop is ready."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={readiness.completedSteps === readiness.totalSteps ? "/app/threads" : readiness.nextHref}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
              >
                {readiness.nextLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/characters"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                Review characters
              </Link>
            </div>
          </div>

          <div className="paper-panel rounded-[2rem] p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Recent threads</p>
                <h2 className="mt-2 font-serif text-3xl text-foreground">Pick up where you left off.</h2>
              </div>
              <Link
                href="/app/threads"
                className="text-sm font-semibold text-brand transition hover:text-brand-strong"
              >
                See all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentThreads.length ? (
                recentThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/app/chats/${thread.id}`}
                    className="block rounded-[1.7rem] border border-border bg-white/5 px-5 py-4 transition hover:border-brand hover:bg-white/8"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{thread.title}</p>
                      {thread.pinned_at ? (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-brand">
                          pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-soft">
                      {thread.characters?.name ?? "Unknown character"}
                      {thread.user_personas?.name ? ` • ${thread.user_personas.name}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-ink-soft">
                      Updated {formatDateTime(thread.updated_at)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1.7rem] border border-dashed border-border bg-white/3 px-5 py-6 text-sm leading-7 text-ink-soft">
                  No thread history yet. As soon as a character gets a real scene, it will land
                  here with timestamps and quick-open access.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="paper-panel rounded-[2rem] p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Latest character</p>
            <h2 className="mt-2 font-serif text-3xl text-foreground">
              {latestCharacter?.name ?? "No character yet"}
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              {latestCharacter
                ? latestCharacter.story ||
                  latestCharacter.core_persona ||
                  latestCharacter.greeting
                : "Create one character sheet with a clear voice, a greeting, and at least one scene direction."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={
                  latestCharacter ? `/app/characters?edit=${latestCharacter.id}` : "/app/characters"
                }
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {latestCharacter ? "Open character" : "Create character"}
              </Link>
              {latestCharacter ? (
                <Link
                  href="/app/characters"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                >
                  Character studio
                </Link>
              ) : null}
            </div>
          </div>

          <div className="paper-panel rounded-[2rem] p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Provider health</p>
            <div className="mt-5 space-y-3">
              {connections.length ? (
                connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="rounded-[1.6rem] border border-border bg-white/5 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{connection.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink-soft">
                          {connection.provider}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          connection.health_status === "healthy"
                            ? "bg-emerald-950/40 text-emerald-400"
                            : connection.health_status === "untested"
                              ? "bg-slate-800/50 text-slate-400"
                              : connection.health_status === "rate_limited"
                                ? "bg-amber-950/40 text-amber-400"
                                : "bg-rose-950/40 text-rose-400"
                        }`}
                      >
                        {connection.health_status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-soft">
                      {connection.health_message ||
                        "Fantasia has not verified this lane yet."}
                    </p>
                    <p className="mt-2 text-xs text-ink-soft">
                      Tested {formatDateTime(connection.last_checked_at)} • Refreshed{" "}
                      {formatDateTime(connection.last_model_refresh_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-border bg-white/3 px-5 py-6 text-sm leading-7 text-ink-soft">
                  No provider lanes yet. Add one, verify it, then refresh models so the chat
                  workspace has something real to switch between.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
