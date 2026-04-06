import { AppShell } from "@/components/app-shell";
import { requireAllowedUser } from "@/lib/auth";
import { listThreads } from "@/lib/data/threads";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireAllowedUser();
  const threads = await listThreads(supabase, user.id);

  return (
    <AppShell email={user.email ?? "unknown"} threads={threads}>
      {children}
    </AppShell>
  );
}
