import { Skeleton } from "@/components/ui/skeleton";

export default function PersonasLoading() {
  return (
    <div className="space-y-8" data-testid="route-loading-state">
      {/* Header panel skeleton */}
      <section className="paper-panel rounded-[2rem] p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-12 w-96 max-w-full" />
        <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      </section>

      {/* Builder + persona list */}
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="paper-panel rounded-[2rem] p-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-44" />
          </div>
          <div className="mt-6 space-y-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
              </div>
            ))}
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </section>

        <section className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <article key={index} className="paper-panel rounded-[2rem] p-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="mt-6 flex gap-3">
                <Skeleton className="h-10 w-28 rounded-full" />
                <Skeleton className="h-10 w-28 rounded-full" />
                <Skeleton className="h-10 w-20 rounded-full" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
