import Link from "next/link";
import { ArrowRight, NotebookTabs, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";

const featureCopy = [
  {
    title: "Manual model switching",
    body: "One voice per thread until you decide to change it. No silent fallback.",
    icon: Orbit,
  },
  {
    title: "Structured continuity",
    body: "Scene state, relationships, and rolling summaries persist alongside the raw transcript.",
    icon: NotebookTabs,
  },
  {
    title: "Private first",
    body: "Single-user, allowlisted auth, BYOK provider secrets, encrypted at rest.",
    icon: ShieldCheck,
  },
];

const startSteps = [
  "Create a default persona.",
  "Connect and test a provider.",
  "Refresh models, build a character, start a thread.",
];

export default async function Home() {
  const { user, isAllowed } = await getCurrentUser();

  return (
    <div
      className="min-h-dvh bg-background-base text-on-surface"
      data-testid="landing-page"
    >
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <BrandMark />
          <Link
            href={user && isAllowed ? "/app" : "/login"}
            className="inline-flex items-center gap-1.5 rounded bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container"
          >
            {user && isAllowed ? "Enter workspace" : "Sign in"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </header>

        {/* Hero */}
        <section className="mt-12 sm:mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Open-Fantasia
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-on-surface sm:text-4xl md:text-5xl">
            Roleplay software for people who care about context.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-on-surface-variant">
            A private workspace for long, emotionally coherent AI roleplay. Bring your own
            providers, switch models explicitly, and let the memory engine track the scene.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={user && isAllowed ? "/app" : "/login"}
              className="inline-flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container"
            >
              {user && isAllowed ? "Continue workspace" : "Start in 2 minutes"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="#architecture"
              className="inline-flex items-center gap-2 rounded border border-border-subtle px-4 py-2 text-sm font-semibold text-on-surface-variant"
            >
              Read the thesis
            </Link>
          </div>

          {!isConfigured() && (
            <div className="mt-6 flex items-center gap-2 rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Add Supabase keys and encryption secret in `.env.local` to activate.
            </div>
          )}
        </section>

        {/* Quick start steps */}
        <section className="mt-10 rounded-lg border border-border-subtle bg-background-front p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Start in 2 minutes
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {startSteps.map((step, index) => (
              <div
                key={step}
                className="rounded border border-border-subtle bg-surface-container-low px-3 py-3"
              >
                <p className="text-xs font-bold text-primary-container">
                  0{index + 1}
                </p>
                <p className="mt-2 text-xs leading-5 text-on-surface-variant">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Chat preview */}
        <section className="mt-8 rounded-lg border border-border-subtle bg-background-front p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Workspace preview
            </p>
            <span className="rounded border border-border-subtle px-2 py-0.5 text-[10px] text-muted-foreground">
              manual switch
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="ml-auto max-w-[80%] rounded-lg rounded-br-sm bg-surface-container-high px-4 py-3 text-sm leading-6 text-on-surface">
              Keep the scene warm, but make the tension sharper. Don&apos;t let
              her forget the promise from the station platform.
            </div>
            <div className="max-w-[82%] rounded-lg rounded-bl-sm border border-border-subtle bg-surface-container px-4 py-3 text-sm leading-6 text-on-surface-variant">
              <p className="italic">
                *She looks at you as if the whole city has gone quiet around the
                sentence.*
              </p>
              <p className="mt-2">
                &ldquo;I didn&apos;t forget. I just kept pretending I had time.&rdquo;
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {featureCopy.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded border border-border-subtle bg-surface-container-low px-3 py-3"
                >
                  <Icon className="h-4 w-4 text-primary-container" />
                  <p className="mt-2 text-xs font-semibold text-on-surface">
                    {feature.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Architecture section */}
        <section
          id="architecture"
          className="mt-10 grid gap-4 border-t border-border-subtle pt-8 sm:grid-cols-3"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Memory architecture
            </p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Threads persist raw chat, structured continuity, and notable beats
              separately so each answer is grounded by more than a single stuffed prompt.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Provider design
            </p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Google AI Studio, Groq, Mistral, OpenRouter, and Ollama Cloud are all
              first-class connections. Each thread chooses explicitly.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Reading surface
            </p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              The transcript uses Pretext for line layout and virtualization so the chat
              feels like an authored surface, not generic markdown.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
