import { Skeleton } from "@/components/ui/skeleton";

export default function PersonasLoading() {
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
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-background-front p-4 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-32" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-6 w-12 rounded" />
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
