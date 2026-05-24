import { AppShell } from "@/components/app-shell";
import { requireAllowedUser } from "@/lib/auth";
import { listRecentThreads } from "@/lib/data/threads";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireAllowedUser();
  const threadsPromise = listRecentThreads(supabase, user.id);

  return (
    <AppShell email={user.email ?? "unknown"} threadsPromise={threadsPromise}>
      {children}
    </AppShell>
  );
}
