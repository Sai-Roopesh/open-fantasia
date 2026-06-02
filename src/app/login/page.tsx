import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SubmitButton } from "@/components/forms/submit-button";
import { isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { signIn } from "@/app/login/actions";

function humanizeLoginReason(reason: string | null) {
  if (!reason) return null;
  if (reason === "signin") return "Sign in to continue.";
  if (reason === "invalid") return "Incorrect username or password.";
  return "Sign-in didn't complete. Try again.";
}

async function LoginCard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : null;
  const configured = isConfigured();
  const { user, isAllowed } = configured
    ? await getCurrentUser()
    : { user: null, isAllowed: false };
  const reasonMessage = humanizeLoginReason(reason);

  return (
    <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-background-front p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Private access
      </p>
      <h1 className="mt-2 font-display text-xl font-bold text-on-surface">
        Sign in
      </h1>
      <p className="mt-2 text-xs leading-5 text-on-surface-variant">
        Enter your username and password to continue.
      </p>

      {!configured && (
        <div className="mt-4 rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          Add Supabase keys and encryption secret in `.env.local` first.
        </div>
      )}

      {reasonMessage && (
        <div
          aria-live="polite"
          className="mt-4 rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning"
        >
          {reasonMessage}
        </div>
      )}

      {user && isAllowed ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-on-surface-variant">
            Signed in as <span className="font-medium text-on-surface">{user.email}</span>.
          </p>
          <Link
            href="/app"
            className="inline-flex rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container"
          >
            Continue to workspace
          </Link>
        </div>
      ) : (
        <form action={signIn} className="mt-4 space-y-3" data-testid="login-form">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-on-surface">Username</span>
            <input
              type="text"
              name="username"
              required
              autoComplete="username"
              placeholder="username"
              className="w-full rounded border-b-2 border-border-subtle bg-input px-3 py-2 text-sm text-on-surface placeholder:text-muted-foreground outline-none focus:border-primary-container"
              data-testid="login-username-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-on-surface">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded border-b-2 border-border-subtle bg-input px-3 py-2 text-sm text-on-surface placeholder:text-muted-foreground outline-none focus:border-primary-container"
              data-testid="login-password-input"
            />
          </label>
          <SubmitButton className="w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container" data-testid="login-submit-button">
            Sign in
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background-base px-5 py-8">
      <div className="mb-8">
        <BrandMark />
      </div>
      <Suspense>
        <LoginCard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
