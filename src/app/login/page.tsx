import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SubmitButton } from "@/components/forms/submit-button";
import { isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { requestMagicLink } from "@/app/login/actions";

function humanizeLoginReason(reason: string | null) {
  if (!reason) return null;
  if (reason === "signin") return "Sign in to continue.";
  if (reason === "invalid") return "Enter your allowlisted email.";
  if (reason.toLowerCase().includes("email")) return "That email couldn't be used. Check the address and allowlist.";
  return "Sign-in didn't complete. Try again.";
}

async function LoginCard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
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
        Use your allowlisted email to receive a magic link.
      </p>

      {!configured && (
        <div className="mt-4 rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          Add Supabase keys and encryption secret in `.env.local` first.
        </div>
      )}

      {sent && (
        <div
          aria-live="polite"
          className="mt-4 rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs text-status-success"
        >
          Magic link sent. Check your email.
        </div>
      )}

      {reasonMessage && !sent && (
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
        <form action={requestMagicLink} className="mt-4 space-y-3" data-testid="login-form">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-on-surface">Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded border-b-2 border-border-subtle bg-input px-3 py-2 text-sm text-on-surface placeholder:text-muted-foreground outline-none focus:border-primary-container"
              data-testid="login-email-input"
            />
          </label>
          <SubmitButton className="w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container" data-testid="login-submit-button">
            Send magic link
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
