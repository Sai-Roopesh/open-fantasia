import { AppShell } from "@/components/app-shell";
import { TransitionProvider } from "@/components/transition-provider";
import { GlobalLoadingBar } from "@/components/global-loading-bar";
import { requireAllowedUser } from "@/lib/auth";
import { listThreads } from "@/lib/data/threads";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireAllowedUser();
  const threadsPromise = listThreads(supabase, user.id);

  return (
    <TransitionProvider>
      <GlobalLoadingBar />
      <AppShell email={user.email ?? "unknown"} threadsPromise={threadsPromise}>
        {children}
      </AppShell>
    </TransitionProvider>
  );
}
