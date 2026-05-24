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
    <div className="space-y-4" data-testid="threads-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-on-surface">
          Threads
        </h1>
        <Link
          href="/app/characters"
          className="inline-flex items-center gap-1 rounded bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container"
        >
          New thread
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {deleted && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Thread removed.
        </div>
      )}

      {/* Search/filter */}
      <form
        method="get"
        action="/app/threads"
        className="flex gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search..."
          className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-muted-foreground outline-none focus:border-primary-container"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-border-subtle bg-surface-container px-2 py-2 text-xs text-on-surface outline-none focus:border-primary-container"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <button
          type="submit"
          className="rounded bg-surface-container-high px-3 py-2 text-xs font-semibold text-on-surface"
        >
          Filter
        </button>
      </form>

      {/* Thread list */}
      <div className="space-y-2">
        {threads.length ? (
          threads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-lg border border-border-subtle bg-background-front p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/chats/${thread.id}`}
                      className="truncate text-sm font-semibold text-on-surface hover:text-primary"
                    >
                      {thread.title}
                    </Link>
                    {thread.pinned_at && (
                      <span className="shrink-0 rounded border border-primary-container/30 bg-primary-container/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-primary-container">
                        pinned
                      </span>
                    )}
                    {thread.status === "archived" && (
                      <span className="shrink-0 rounded border border-muted-foreground/30 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                        archived
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.character_name ?? "Unknown"}
                    {thread.persona_name ? ` · ${thread.persona_name}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Updated {formatDateTime(thread.updated_at)}
                    {thread.archived_at ? ` · Archived ${formatDateTime(thread.archived_at)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/app/chats/${thread.id}`}
                    className="rounded bg-primary-container/10 px-2 py-1 text-xs font-semibold text-primary-container"
                  >
                    Open
                  </Link>

                  <form action={setThreadPinnedAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input type="hidden" name="pinned" value={thread.pinned_at ? "false" : "true"} />
                    <button
                      type="submit"
                      className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:text-on-surface"
                      aria-label={thread.pinned_at ? "Unpin" : "Pin"}
                    >
                      {thread.pinned_at ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  </form>

                  <form action={setThreadArchiveAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input type="hidden" name="status" value={thread.status === "archived" ? "active" : "archived"} />
                    <button
                      type="submit"
                      className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:text-on-surface"
                      aria-label={thread.status === "archived" ? "Restore" : "Archive"}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Expandable manage section */}
              <details className="mt-3 rounded border border-border-subtle bg-surface-container-low px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-on-surface-variant">
                  <PencilLine className="mr-1 inline h-3 w-3" />
                  Manage
                </summary>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <form action={renameThreadAction} className="flex flex-1 gap-2">
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input
                      name="title"
                      defaultValue={thread.title}
                      className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-container px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary-container"
                    />
                    <button
                      type="submit"
                      className="rounded bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container"
                    >
                      Save
                    </button>
                  </form>
                  <form action={deleteThreadFromListAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Delete this thread and all of its branches, messages, snapshots, and pins?"
                      className="rounded bg-status-critical/10 border border-status-critical/30 px-3 py-1.5 text-xs font-semibold text-status-critical"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </details>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
            No threads match this view. Start one from a character sheet.
          </div>
        )}
      </div>
    </div>
  );
}
