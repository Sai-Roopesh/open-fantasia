import { Skeleton } from "@/components/ui/skeleton";

export default function ProvidersLoading() {
  return (
    <div className="space-y-8" data-testid="route-loading-state">
      {/* Header panel */}
      <section className="paper-panel rounded-[2rem] p-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-12 w-80 max-w-full" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
      </section>

      {/* Provider form skeleton */}
      <section className="paper-panel rounded-[2rem] p-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="mt-6 space-y-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </section>

      {/* Provider card skeletons */}
      <section className="space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <article key={index} className="paper-panel rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-5 w-full max-w-md" />
            <div className="mt-4 flex gap-3">
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
