import Link from "next/link";
import { ArchiveRestore, ArrowRight, PencilLine, Pin, PinOff } from "lucide-react";
import { requireAllowedUser } from "@/lib/auth";
import { listThreadItems } from "@/lib/data/threads";
import {
  deleteThreadFromListAction,
  renameThreadAction,
  setThreadArchiveAction,
  setThreadPinnedAction,
} from "@/app/(app)/app/threads/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { formatDateTime } from "@/lib/utils";

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAllowedUser();
  const query = typeof params.q === "string" ? params.q : "";
  const status =
    typeof params.status === "string" && ["active", "archived", "all"].includes(params.status)
      ? (params.status as "active" | "archived" | "all")
      : "active";
  const deleted = params.deleted === "1";
  const threads = await listThreadItems(supabase, user.id, { query, status });

  return (
    <div className="space-y-8" data-testid="threads-page">
      <section className="paper-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">Thread library</p>
            <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground">
              Every active scene, branch-ready and easy to resume.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">
              Search by title, sort by what was touched most recently, and keep the handful of
              threads you revisit often pinned near the top.
            </p>
          </div>

          <Link
            href="/app/characters"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          Start from a character
          <ArrowRight className="h-4 w-4" />
        </Link>
        </div>

        {deleted ? (
          <div className="mt-5 rounded-2xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Thread removed from the library.
          </div>
        ) : null}

        <form
          method="get"
          action="/app/threads"
          className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem]"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground">Search threads</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by thread, character, or persona..."
              className="w-full rounded-full border border-border bg-white/5 px-4 py-3 outline-none transition focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-full border border-border bg-white/5 px-4 py-3 outline-none transition focus:border-brand"
            >
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
              <option value="all">Everything</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white/8 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
            >
              Apply filters
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {threads.length ? (
          threads.map((thread) => (
            <article key={thread.id} className="paper-panel rounded-[2rem] p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-3xl text-foreground">{thread.title}</h2>
                    {thread.pinned_at ? (
                      <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                        pinned
                      </span>
                    ) : null}
                    {thread.status === "archived" ? (
                      <span className="rounded-full bg-slate-800/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        archived
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-soft">
                    {thread.character_name ?? "Unknown character"}
                    {thread.persona_name ? ` • ${thread.persona_name}` : ""}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">
                    Updated {formatDateTime(thread.updated_at)}
                    {thread.archived_at ? ` • Archived ${formatDateTime(thread.archived_at)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/app/chats/${thread.id}`}
                    className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Open thread
                  </Link>

                  <form action={setThreadPinnedAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input
                      type="hidden"
                      name="pinned"
                      value={thread.pinned_at ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                    >
                      {thread.pinned_at ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                      {thread.pinned_at ? "Unpin" : "Pin"}
                    </button>
                  </form>

                  <form action={setThreadArchiveAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={thread.status === "archived" ? "active" : "archived"}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      {thread.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </form>
                </div>
              </div>

              <details className="mt-5 rounded-[1.5rem] border border-border bg-white/5 px-4 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <PencilLine className="h-4 w-4 text-brand" />
                    Manage thread details
                  </span>
                </summary>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <form action={renameThreadAction} className="flex flex-col gap-3 sm:flex-row">
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input
                      name="title"
                      defaultValue={thread.title}
                      className="min-w-0 flex-1 rounded-full border border-border bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
                    >
                      Save title
                    </button>
                  </form>

                  <form action={deleteThreadFromListAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Delete this thread and all of its branches, messages, snapshots, and pins?"
                      className="border border-red-900/40 bg-red-950/40 text-red-400 hover:bg-red-900/50"
                    >
                      Delete thread
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </details>
            </article>
          ))
        ) : (
          <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-ink-soft">
            No threads match this view yet. Start one from a character sheet, or switch the status
            filter if you want to inspect archived scenes.
          </div>
        )}
      </section>
    </div>
  );
}
