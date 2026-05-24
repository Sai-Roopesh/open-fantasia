import { Skeleton } from "@/components/ui/skeleton";

export default function CharactersLoading() {
  return (
    <div className="space-y-4" data-testid="route-loading-state">
      <Skeleton className="h-6 w-32" />
      <div className="rounded-lg border border-border-subtle bg-background-front p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-background-front p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full max-w-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
