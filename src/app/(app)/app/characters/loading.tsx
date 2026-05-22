import { Skeleton } from "@/components/ui/skeleton";

export default function CharactersLoading() {
  return (
    <div className="space-y-8" data-testid="route-loading-state">
      {/* Header panel skeleton */}
      <section className="paper-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-80 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
        </div>
      </section>

      {/* Builder + character list skeletons */}
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="paper-panel rounded-[2rem] p-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-52" />
          </div>
          <div className="mt-6 space-y-5">
            {Array.from({ length: 5 }).map((_, index) => (
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
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="mt-2 h-16 w-full" />
              </div>
              <div className="mt-6 flex gap-3">
                <Skeleton className="h-10 w-24 rounded-full" />
                <Skeleton className="h-10 w-28 rounded-full" />
                <Skeleton className="h-10 w-32 rounded-full" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
