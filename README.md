# Open-Fantasia

Open-Fantasia is a private, single-user roleplay workspace built with Next.js App Router, Supabase, AI SDK v6, and a Pretext-powered transcript renderer.

## What is included

- Landing page and private magic-link login flow
- Allowlisted access guard via Supabase auth and `proxy.ts`
- Character builder and thread launcher
- BYOK provider settings for Google AI Studio, Groq, Mistral, OpenRouter, and Ollama Cloud or remote Ollama-compatible URLs
- Manual model switching per thread
- Streaming chat route with AI SDK v6
- Structured continuity reconciliation after each assistant turn
- Pretext transcript layout for line breaking, shrinkwrap bubble widths, and virtualization
- Supabase SQL migration for profiles, connections, characters, threads, messages, snapshots, and timeline events

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ALLOWED_EMAILS=you@example.com
APP_ENCRYPTION_KEY=any-long-random-secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup

Run the SQL in [supabase/migrations/0001_init.sql](/Users/sairoopesh/Documents/projects/Open-Fantasia/supabase/migrations/0001_init.sql) against your Supabase project before using the app.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm build
```
