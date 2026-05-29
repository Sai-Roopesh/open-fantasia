import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAllowedUser } from "@/lib/auth";
import { listThreadItems } from "@/lib/data/threads";
import { ThreadList } from "@/components/threads/thread-list";

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
      <ThreadList threads={threads} status={status} />
    </div>
  );
}
