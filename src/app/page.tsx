import Link from "next/link";
import { ArrowRight, NotebookTabs, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";

const featureCopy = [
  {
    title: "Manual model switching",
    body: "Keep one voice per thread until you decide to change it. No silent fallback, no personality drift by surprise.",
    icon: Orbit,
  },
  {
    title: "Structured continuity",
    body: "Scenario state, relationship state, open loops, and rolling summaries are persisted alongside the raw transcript.",
    icon: NotebookTabs,
  },
  {
    title: "Private first",
    body: "Single-user access, allowlisted auth, BYOK provider secrets, and roleplay surfaces built for your own workflow first.",
    icon: ShieldCheck,
  },
];

const startSteps = [
  "Create one default persona so the app knows how you speak.",
  "Connect and test one free or BYOK provider lane.",
  "Refresh models, build a character, and start the first thread.",
];

export default async function Home() {
  const { user, isAllowed } = await getCurrentUser();

  return (
    <div className="min-h-screen overflow-hidden bg-[#160f0b] text-white" data-testid="landing-page">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,168,91,0.26),transparent_20%),radial-gradient(circle_at_75%_18%,rgba(51,112,114,0.28),transparent_26%),linear-gradient(180deg,#160f0b_0%,#2a1b12_50%,#110d0a_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[42rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-12 pt-8 md:px-10">
          <header className="flex items-center justify-between">
            <BrandMark />
            <Link
              href={user && isAllowed ? "/app" : "/login"}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/16"
            >
              {user && isAllowed ? "Enter workspace" : "Private sign-in"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          <section className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.38em] text-white/60">
                Open-Fantasia v0.0.1
              </p>
              <h1 className="mt-5 max-w-4xl font-serif text-6xl leading-[0.9] md:text-8xl">
                Roleplay software for people who would rather chase better context than bigger bills.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-white/72">
                Fantasia is a responsive web app for long, emotionally coherent AI roleplay with bring-your-own providers, explicit model switching, and a memory layer that tracks the scene instead of praying the prompt still remembers it.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href={user && isAllowed ? "/app" : "/login"}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f2d2b6] px-6 py-3 text-sm font-semibold text-[#2b170e] transition hover:bg-[#f7dfca]"
                >
                  {user && isAllowed ? "Continue your workspace" : "Start in 2 minutes"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#architecture"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-6 py-3 text-sm transition hover:bg-white/14"
                >
                  Read the build thesis
                </Link>
                </div>

              <div className="mt-8 max-w-2xl rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                  Start in 2 minutes
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {startSteps.map((step, index) => (
                    <div
                      key={step}
                      className="rounded-[1.35rem] border border-white/10 bg-black/12 px-4 py-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-[#f0cba9]">
                        0{index + 1}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-white/78">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {!isConfigured() ? (
                <div className="mt-8 inline-flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Add Supabase keys, your allowlist, and an encryption secret in
                  `.env.local` to activate the private build.
                </div>
              ) : null}
            </div>

            <div className="rounded-[2.25rem] border border-white/12 bg-white/8 p-5 backdrop-blur-xl">
              <div className="rounded-[1.8rem] border border-white/10 bg-[#1d1511]/90 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/55">
                      Workspace promise
                  </p>
                    <p className="mt-2 font-serif text-3xl">Pretext-driven scene glass</p>
                </div>
                <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/70">
                  manual switch
                </div>
              </div>

                <div className="mt-8 space-y-4">
                  <div className="ml-auto max-w-[75%] rounded-[1.75rem] rounded-br-md bg-[#f0e0cf] px-5 py-4 text-sm leading-7 text-[#24140c] shadow-lg">
                    Keep the scene warm, but make the tension sharper. Don&apos;t let
                    her forget the promise from the station platform.
                  </div>
                  <div className="max-w-[78%] rounded-[1.75rem] rounded-bl-md border border-white/10 bg-[#2a1b13] px-5 py-4 text-sm leading-7 text-white/88">
                    <p>
                      *She looks at you as if the whole city has gone quiet around
                      the sentence.*
                    </p>
                    <p className="mt-3">
                      “I didn&apos;t forget. I just kept pretending I had time.”
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {featureCopy.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.title}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <Icon className="h-4 w-4 text-[#f0cba9]" />
                        <p className="mt-3 text-sm font-semibold text-white">
                          {feature.title}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-white/58">
                          {feature.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section id="architecture" className="grid gap-6 border-t border-white/10 py-10 text-sm text-white/68 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">
                Memory architecture
              </p>
              <p className="mt-3 leading-7">
                Threads persist raw chat, structured continuity, and notable
                beats separately so each answer is grounded by more than a single
                stuffed prompt.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">
                Provider design
              </p>
              <p className="mt-3 leading-7">
                Google AI Studio, Groq, Mistral, OpenRouter, and Ollama Cloud are
                all first-class connections. Each thread chooses explicitly.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">
                Reading surface
              </p>
              <p className="mt-3 leading-7">
                The transcript uses Pretext for line layout, shrinkwrap bubbles,
                and virtualization so the chat feels like an authored surface,
                not generic markdown in a div.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
