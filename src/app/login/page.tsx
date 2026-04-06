import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SubmitButton } from "@/components/forms/submit-button";
import { isConfigured, isLocalDevAuthBypassEnabled } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { requestMagicLink } from "@/app/login/actions";

function humanizeLoginReason(reason: string | null) {
  if (!reason) return null;
  const lower = reason.toLowerCase();

  if (reason === "setup") {
    return "Fantasia still needs its Supabase and encryption environment variables before sign-in can work.";
  }
  if (reason === "signin") {
    return "Sign in to open your private workspace.";
  }
  if (reason === "invalid") {
    return "Enter the allowlisted email you want to use for this build.";
  }
  if (lower.includes("rate limit")) {
    return "Email sending is rate limited right now. On localhost, submitting an allowlisted email will still continue immediately.";
  }
  if (lower.includes("email")) {
    return "That email could not be used for sign-in. Double-check the address and make sure it is on your allowlist.";
  }

  return "Sign-in didn’t complete. Try again, or retry from localhost if you’re still building locally.";
}

async function LoginCard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const reason = typeof params.reason === "string" ? params.reason : null;
  const { user, isAllowed } = await getCurrentUser();
  const showLocalDevAccess = isLocalDevAuthBypassEnabled();
  const reasonMessage = humanizeLoginReason(reason);

  return (
    <div className="paper-panel w-full max-w-md rounded-[2rem] p-8">
      <p className="text-xs uppercase tracking-[0.28em] text-ink-soft">
        Private access
      </p>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground">
        Enter the thread room.
      </h1>
      <p className="mt-4 text-sm leading-7 text-ink-soft">
        Fantasia ships as a private workspace first. Use your allowlisted email
        to receive a magic link and continue on phone or laptop.
      </p>

      {showLocalDevAccess ? (
        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 p-4 text-sm leading-7 text-accent">
          Localhost dev access is enabled. Submitting an allowlisted email here
          will continue directly without waiting for mailbox delivery.
        </div>
      ) : null}

      {!isConfigured() ? (
        <div className="mt-6 rounded-2xl border border-dashed border-brand/40 bg-brand/8 p-4 text-sm text-brand-strong">
          Add your Supabase keys, allowlist, and encryption secret in
          `.env.local` before sign-in can work.
        </div>
      ) : null}

      {sent ? (
        <div aria-live="polite" className="mt-6 rounded-2xl bg-accent/12 p-4 text-sm text-accent">
          Magic link sent. Open the email on this device to continue.
        </div>
      ) : null}

      {reasonMessage && !sent ? (
        <div aria-live="polite" className="mt-6 rounded-2xl bg-brand/10 p-4 text-sm text-brand-strong">
          {reasonMessage}
        </div>
      ) : null}

      {user && isAllowed ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-foreground">
            You are already authenticated as <span className="font-medium">{user.email}</span>.
          </p>
          <Link
            href="/app"
            className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Continue to workspace
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <form action={requestMagicLink} className="space-y-4" data-testid="login-form">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none transition focus:border-brand"
                data-testid="login-email-input"
              />
            </label>
            <SubmitButton className="w-full" data-testid="login-submit-button">
              {showLocalDevAccess ? "Continue" : "Send magic link"}
            </SubmitButton>
          </form>
        </div>
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
    <div className="min-h-screen overflow-hidden bg-[#1c120d] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(241,157,102,0.44),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(71,123,132,0.38),transparent_26%),radial-gradient(circle_at_50%_85%,rgba(255,245,234,0.14),transparent_36%),linear-gradient(135deg,#120c09_0%,#2b1811_45%,#120c09_100%)]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent)]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-8 md:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <BrandMark />
            <div className="mt-10 max-w-xl">
              <p className="text-xs uppercase tracking-[0.34em] text-white/65">
                v0.0.1 private build
              </p>
              <h2 className="mt-4 font-serif text-5xl leading-[0.95] md:text-7xl">
                Long-form roleplay, held together by memory instead of luck.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-8 text-white/72 md:text-lg">
                Swap between free hosted models, keep thread continuity alive,
                and read every scene through a custom Pretext transcript surface.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  "Sign in with the one allowlisted identity this workspace trusts.",
                  "Use the dashboard checklist to connect a provider, persona, and character.",
                  "Start a thread and keep continuity inspectable instead of guesswork-driven.",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[#f0cba9]">
                      0{index + 1}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/75">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Suspense>
            <LoginCard searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
