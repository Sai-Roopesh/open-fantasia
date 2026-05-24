import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadsLoading() {
  return (
    <div className="space-y-4" data-testid="route-loading-state">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-7 w-24 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-8 w-14 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-background-front p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-6 w-12 rounded" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
