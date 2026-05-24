import { Skeleton } from "@/components/ui/skeleton";

export default function ProvidersLoading() {
  return (
    <div className="space-y-4" data-testid="route-loading-state">
      <Skeleton className="h-6 w-24" />
      <div className="rounded-lg border border-border-subtle bg-background-front p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-28 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-background-front p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-48" />
            <div className="flex gap-1 mt-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-20 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
