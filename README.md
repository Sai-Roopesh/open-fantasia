# Open-Fantasia

Open-Fantasia is a private, single-user roleplay workspace built with Next.js App Router, Supabase, AI SDK v6, shadcn/ui primitives, a DB-backed reconciliation job queue, and a Pretext-powered transcript renderer.

## What is included

- Landing page and private magic-link login flow
- Allowlisted access guard via Supabase auth and `proxy.ts`
- Persona library, character studio, and thread launcher
- BYOK provider settings for Google AI Studio, Groq, Mistral, OpenRouter, and Ollama Cloud or remote Ollama-compatible URLs
- Manual model switching per thread
- Streaming chat route with AI SDK v6
- Async continuity reconciliation through `background_jobs`
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

Run the SQL in [supabase/migrations/0001_baseline.sql](/Users/sairoopesh/Documents/projects/Open-Fantasia/supabase/migrations/0001_baseline.sql) against your Supabase project before using the app.

## Background jobs

Thread reconciliation now runs through the `background_jobs` table instead of the visible response path.

- The worker route is `/api/internal/jobs/run`
- Local development can trigger it directly after enqueue
- Vercel Cron is configured in [vercel.json](/Users/sairoopesh/Documents/projects/Open-Fantasia/vercel.json)
- Set `CRON_SECRET` in production so scheduled worker invocations are authenticated

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
