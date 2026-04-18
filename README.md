# Open-Fantasia

Open-Fantasia is a private, single-user roleplay workspace built with Next.js App Router, Supabase, AI SDK v6, shadcn/ui primitives, inline continuity materialization, and a Pretext-powered transcript renderer.

## What is included

- Landing page and private magic-link login flow
- Allowlisted access guard via Supabase auth and `proxy.ts`
- Persona library, character studio, and thread launcher
- BYOK provider settings for Google AI Studio, Groq, Mistral, OpenRouter, and Ollama Cloud or remote Ollama-compatible URLs
- Manual model switching per thread
- Streaming chat route with AI SDK v6
- Inline continuity snapshot materialization for committed turns
- Best-effort background portrait generation after character saves
- Pretext transcript layout for line breaking, shrinkwrap bubble widths, and virtualization
- A single baseline Supabase SQL migration for the full workspace schema
- Vitest unit coverage and Playwright E2E scaffolding

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ALLOWED_EMAILS=you@example.com
APP_ENCRYPTION_KEY=any-long-random-secret
SUPABASE_SERVICE_ROLE_KEY=
ENABLE_LOCAL_DEV_AUTH_BYPASS=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
```

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup

Run the SQL in [supabase/migrations/0001_baseline.sql](/Users/sairoopesh/Documents/projects/Open-Fantasia/supabase/migrations/0001_baseline.sql) against your Supabase project before using the app. This file is the full current schema baseline.

## Background jobs

Continuity snapshots are materialized on the request path as soon as a turn is committed, so new turns do not depend on a cron worker or queue drain finishing later.

Portrait generation remains asynchronous and is kicked off with `after()` after character saves and regenerations. The manual worker route is still available at `/api/internal/jobs/run` if you need to drain portrait work explicitly.

- `CRON_SECRET` is only needed if you want to call the internal worker route directly
- Vercel Cron is not required for normal operation

## Testing

Unit tests:

```bash
pnpm test:unit
```

Playwright suite listing:

```bash
pnpm test:e2e:list
```

Full Playwright run:

```bash
pnpm test:e2e
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
```
