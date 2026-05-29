"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchiveRestore, PencilLine, Pin, PinOff } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useOptimisticList } from "@/components/shared/use-optimistic-list";
import {
  deleteThreadFromListAction,
  renameThreadAction,
  setThreadArchiveAction,
  setThreadPinnedAction,
} from "@/app/(app)/app/threads/actions";
import { formatDateTime } from "@/lib/utils";
import type { ThreadListItem } from "@/lib/types";

export function ThreadList({
  threads,
  status,
}: {
  threads: ThreadListItem[];
  status: "active" | "archived" | "all";
}) {
  const { items, run } = useOptimisticList(threads, (thread) => thread.id);
  const { confirm, confirmDialog } = useConfirmation();
  const [error, setError] = useState<string | null>(null);

  function togglePin(thread: ThreadListItem) {
    const nextPinned = !thread.pinned_at;
    run(
      {
        kind: "update",
        id: thread.id,
        patch: { pinned_at: nextPinned ? new Date().toISOString() : null },
      },
      () => setThreadPinnedAction({ threadId: thread.id, pinned: nextPinned }),
      setError,
    );
  }

  function toggleArchive(thread: ThreadListItem) {
    const nextStatus = thread.status === "archived" ? "active" : "archived";
    const leavesView =
      (status === "active" && nextStatus === "archived") ||
      (status === "archived" && nextStatus === "active");
    run(
      leavesView
        ? { kind: "remove", id: thread.id }
        : {
            kind: "update",
            id: thread.id,
            patch: {
              status: nextStatus,
              archived_at: nextStatus === "archived" ? new Date().toISOString() : null,
            },
          },
      () => setThreadArchiveAction({ threadId: thread.id, status: nextStatus }),
      setError,
    );
  }

  function rename(thread: ThreadListItem, title: string) {
    run(
      { kind: "update", id: thread.id, patch: { title } },
      () => renameThreadAction({ threadId: thread.id, title }),
      setError,
    );
  }

  function remove(thread: ThreadListItem) {
    confirm({
      title: "Delete this thread?",
      description:
        "This permanently deletes the thread and all of its branches, messages, snapshots, and pins.",
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: () =>
        run(
          { kind: "remove", id: thread.id },
          () => deleteThreadFromListAction({ threadId: thread.id }),
          setError,
        ),
    });
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
        No threads match this view. Start one from a character sheet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div
          aria-live="polite"
          className="rounded border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs font-medium text-status-critical"
        >
          {error}
        </div>
      ) : null}

      {items.map((thread) => (
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

              <button
                type="button"
                onClick={() => togglePin(thread)}
                className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:text-on-surface"
                aria-label={thread.pinned_at ? "Unpin" : "Pin"}
              >
                {thread.pinned_at ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => toggleArchive(thread)}
                className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:text-on-surface"
                aria-label={thread.status === "archived" ? "Restore" : "Archive"}
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Expandable manage section */}
          <details className="mt-3 rounded border border-border-subtle bg-surface-container-low px-3 py-2">
            <summary className="cursor-pointer list-none text-xs font-semibold text-on-surface-variant">
              <PencilLine className="mr-1 inline h-3 w-3" />
              Manage
            </summary>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <form
                className="flex flex-1 gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = String(
                    new FormData(event.currentTarget).get("title") ?? "",
                  ).trim();
                  if (value && value !== thread.title) {
                    rename(thread, value);
                  }
                }}
              >
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
              <button
                type="button"
                onClick={() => remove(thread)}
                className="rounded bg-status-critical/10 border border-status-critical/30 px-3 py-1.5 text-xs font-semibold text-status-critical"
              >
                Delete
              </button>
            </div>
          </details>
        </article>
      ))}

      {confirmDialog}
    </div>
  );
}
