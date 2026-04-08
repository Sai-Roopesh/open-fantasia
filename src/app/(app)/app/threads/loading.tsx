import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadsLoading() {
  return (
    <div className="space-y-8" data-testid="route-loading-state">
      {/* Header panel skeleton */}
      <section className="paper-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-96 max-w-full" />
            <Skeleton className="h-5 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-11 w-48 rounded-full" />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </section>

      {/* Thread card skeletons */}
      <section className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="paper-panel rounded-[2rem] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-28 rounded-full" />
                <Skeleton className="h-10 w-16 rounded-full" />
                <Skeleton className="h-10 w-20 rounded-full" />
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
