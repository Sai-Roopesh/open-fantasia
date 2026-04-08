import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { TransitionProvider } from "@/components/transition-provider";
import { GlobalLoadingBar } from "@/components/global-loading-bar";
import { requireAllowedUser } from "@/lib/auth";
import { listThreads } from "@/lib/data/threads";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Async Server Component that loads sidebar thread data.
 * Wrapped in Suspense so it streams in without blocking child pages.
 */
async function SidebarData({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAllowedUser();
  const threads = await listThreads(supabase, user.id);

  return (
    <AppShell email={user.email ?? "unknown"} threads={threads}>
      {children}
    </AppShell>
  );
}

/** Skeleton shell shown while sidebar data streams in. */
function AppShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Sidebar skeleton — hidden on mobile */}
        <aside className="hidden min-h-screen border-r border-white/8 bg-[#161110]/94 px-5 py-6 backdrop-blur xl:block">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
          <div className="mt-8 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-2xl" />
            ))}
          </div>
          <div className="mt-10">
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </aside>

        {/* Content area — renders immediately */}
        <div className="min-h-screen pb-24 xl:pb-0">
          <main id="app-main" className="min-h-screen px-4 py-5 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TransitionProvider>
      <GlobalLoadingBar />
      <Suspense fallback={<AppShellSkeleton>{children}</AppShellSkeleton>}>
        <SidebarData>{children}</SidebarData>
      </Suspense>
    </TransitionProvider>
  );
}
