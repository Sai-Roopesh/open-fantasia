import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-dvh flex-col bg-background-base" data-testid="route-loading-state">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/80 px-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </header>
      <div className="flex-1 space-y-4 p-4">
        <div className="ml-auto max-w-[75%]">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="max-w-[78%]">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="ml-auto max-w-[70%]">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
      <div className="shrink-0 border-t border-border-subtle px-3 py-3">
        <Skeleton className="h-10 w-full rounded" />
      </div>
    </div>
  );
}
