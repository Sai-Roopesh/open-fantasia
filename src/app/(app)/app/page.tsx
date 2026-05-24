import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
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
    { key: "persona", label: "Create one default persona", done: args.hasDefaultPersona, href: "/app/personas" },
    { key: "provider", label: "Save at least one provider lane", done: args.hasProvider, href: "/app/settings/providers" },
    { key: "health", label: "Verify a provider connection", done: args.hasHealthyProvider, href: "/app/settings/providers" },
    { key: "models", label: "Refresh available models", done: args.hasRefreshedModels, href: "/app/settings/providers" },
    { key: "character", label: "Build your first character sheet", done: args.hasCharacter, href: "/app/characters" },
    { key: "thread", label: "Start your first live thread", done: args.hasThread, href: "/app/characters" },
  ];

  const next = ordered.find((step) => !step.done) ?? ordered[ordered.length - 1];
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
      completedSteps === ordered.length ? "Open your thread library" : next.label,
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

  const recentThreads = threads.slice(0, 6);
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
    { label: "Default persona", done: readiness.hasDefaultPersona, detail: defaultPersona ? `${defaultPersona.name} is ready.` : "Threads need a user identity." },
    { label: "Provider lane", done: readiness.hasProvider, detail: connections.length ? `${connections.length} saved.` : "Add a provider connection." },
    { label: "Connection health", done: readiness.hasHealthyProvider, detail: healthyProviders.length ? `${healthyProviders.length} verified.` : "Run a connection test." },
    { label: "Models refreshed", done: readiness.hasRefreshedModels, detail: refreshedProviders.length ? `${refreshedProviders.length} ready.` : "Refresh at least one lane." },
    { label: "Character sheet", done: readiness.hasCharacter, detail: latestCharacter ? `${latestCharacter.name} available.` : "Build a character." },
    { label: "Live thread", done: readiness.hasThread, detail: activeThreads.length ? `${activeThreads.length} active.` : "Start your first thread." },
  ];

  const allDone = readiness.completedSteps === readiness.totalSteps;

  return (
    <div className="space-y-6" data-testid="workspace-dashboard">
      {/* Setup progress */}
      <section className="rounded-lg border border-border-subtle bg-background-front p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Setup progress
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-on-surface sm:text-3xl">
              {readiness.completedSteps}/{readiness.totalSteps}
            </p>
          </div>
          <Link
            href={allDone ? "/app/threads" : readiness.nextHref}
            className="inline-flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container"
          >
            {readiness.nextLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-primary-container"
            style={{ width: `${(readiness.completedSteps / readiness.totalSteps) * 100}%` }}
          />
        </div>

        {/* Checklist */}
        <div className="mt-4 space-y-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded border border-border-subtle bg-surface-container-low px-3 py-2"
            >
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
              ) : (
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-on-surface">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent threads — card grid */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-on-surface">Recent threads</h2>
          <Link
            href="/app/threads"
            className="text-xs font-semibold text-primary-container"
          >
            View all
          </Link>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentThreads.length ? (
            recentThreads.map((thread) => (
              <Link
                key={thread.id}
                href={`/app/chats/${thread.id}`}
                className="rounded-lg border border-border-subtle bg-background-front p-4 hover:border-primary-container/40"
              >
                <div className="flex items-center gap-2">
                  {/* Portrait circle placeholder */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant">
                    {(thread.characters?.name ?? "?")[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {thread.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.characters?.name ?? "Unknown"}
                      {thread.user_personas?.name ? ` · ${thread.user_personas.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {thread.pinned_at && (
                    <span className="rounded border border-primary-container/30 bg-primary-container/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-primary-container">
                      pinned
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(thread.updated_at)}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
              No threads yet. Create a character and start your first story.
            </div>
          )}
        </div>
      </section>

      {/* Quick links grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Latest character */}
        <section className="rounded-lg border border-border-subtle bg-background-front p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Latest character
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-on-surface">
            {latestCharacter?.name ?? "No character yet"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {latestCharacter
              ? latestCharacter.story || latestCharacter.core_persona || latestCharacter.greeting
              : "Create a character to get started."}
          </p>
          <Link
            href={latestCharacter ? `/app/characters?edit=${latestCharacter.id}` : "/app/characters"}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-container"
          >
            {latestCharacter ? "Open character" : "Create character"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>

        {/* Provider health */}
        <section className="rounded-lg border border-border-subtle bg-background-front p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Providers
          </p>
          {connections.length ? (
            <div className="mt-2 space-y-2">
              {connections.slice(0, 3).map((connection) => (
                <div key={connection.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-on-surface">{connection.label}</span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${
                      connection.health_status === "healthy"
                        ? "border-status-success/30 bg-status-success/10 text-status-success"
                        : connection.health_status === "untested"
                          ? "border-status-unknown/30 bg-status-unknown/10 text-status-unknown"
                          : connection.health_status === "rate_limited"
                            ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                            : "border-status-critical/30 bg-status-critical/10 text-status-critical"
                    }`}
                  >
                    {connection.health_status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No providers configured yet.</p>
          )}
          <Link
            href="/app/settings/providers"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-container"
          >
            Manage providers
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>
    </div>
  );
}
