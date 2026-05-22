import { Skeleton } from "@/components/ui/skeleton";

export default function ChatThreadLoading() {
  return (
    <div className="space-y-6" data-testid="route-loading-state">
      {/* Thread header panel */}
      <section className="paper-panel rounded-[2rem] p-8">
        <Skeleton className="h-3 w-24" />
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Skeleton className="h-20 w-52 rounded-[1.5rem]" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </section>

      {/* Chat workspace */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="paper-panel rounded-[2rem] p-6">
          {/* Live scene header */}
          <div className="border-b border-border pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Skeleton className="h-20 w-full rounded-[1.4rem]" />
              <Skeleton className="h-20 w-full rounded-[1.4rem]" />
            </div>
          </div>

          {/* Transcript skeleton */}
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ))}
          </div>

          {/* Composer skeleton */}
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <Skeleton className="h-20 flex-1 rounded-[1.75rem]" />
            <Skeleton className="h-11 w-24 rounded-full" />
          </div>
        </section>

        {/* Inspector panel skeleton */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="paper-panel rounded-[2rem] p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-20 rounded-full" />
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-[1.5rem]" />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
