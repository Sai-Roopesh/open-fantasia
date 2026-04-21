<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Open-Fantasia Agent Guide

This file is the authoritative repo-specific starting point for future agents.

## Read Order

1. `README.md`
2. `docs/architecture.md`
3. `docs/data-model.md`
4. `docs/workflows.md`

If those docs conflict with the code, trust the code and update the docs as part of your change.

## Project Snapshot

- Product: a private, single-user roleplay workspace for long-form AI conversations
- Frontend: Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui-style primitives, Base UI, Pretext transcript layout
- Backend: Supabase auth, Postgres, storage, RLS, SQL RPCs
- AI runtime: Vercel AI SDK v6 plus BYOK connections for Google, Groq, Mistral, OpenRouter, and Ollama-compatible endpoints
- Deployment: Vercel

## Important Invariants

- `/app` is private. Access is gated through `src/proxy.ts` plus a `profiles.is_allowed` check.
- Magic-link auth is Supabase-backed. `ALLOWED_EMAILS` only bootstraps first access; ongoing authorization is profile-backed.
- Every live thread must carry an explicit `character_id`, `connection_id`, `model_id`, and `persona_id`.
- Every thread has exactly one active branch.
- Branch generation is serialized with `generation_locked` and `locked_by_turn_id`.
- New turns, rewrites, and regenerations all end by materializing a continuity snapshot inline with `materializeSnapshotForTurn(...)`.
- If the latest committed turn does not have a usable head snapshot, the chat UI blocks further progress until the branch is repaired.
- Character portraits are asynchronous and run through `character_portrait_tasks`; continuity snapshots are no longer queued in normal operation.
- Provider secrets are encrypted with AES-256-GCM via `APP_ENCRYPTION_KEY`, which must be a 64-character hex string.
- Schema changes are append-only under `supabase/migrations/`.

## Where Things Live

### UI and routing

- `src/app/page.tsx`: public landing page
- `src/app/login/*`: magic-link login flow
- `src/app/auth/*`: auth callback and sign-out
- `src/app/(app)/app/*`: protected dashboard, personas, characters, threads, providers, chat pages
- `src/components/*`: reusable UI, chat workspace, forms, shell

### Server actions

- `src/app/(app)/app/personas/actions.ts`
- `src/app/(app)/app/characters/actions.ts`
- `src/app/(app)/app/threads/actions.ts`
- `src/app/(app)/app/chats/[threadId]/actions.ts`
- `src/app/(app)/app/settings/providers/actions.ts`

### API routes

- `src/app/api/chat/route.ts`: streaming main chat route
- `src/app/api/chats/[threadId]/*`: branch, edit, regenerate, starter, rewind, pins, rating
- `src/app/api/providers/*`: test connection and refresh model cache
- `src/app/api/internal/jobs/run/route.ts`: protected task drain endpoint

### Domain and data layer

- `src/lib/ai/*`: provider wiring, prompts, continuity, generation runtime
- `src/lib/data/*`: Supabase reads and writes
- `src/lib/threads/read-model.ts`: thread graph assembly and transcript context building
- `src/lib/jobs/*`: task draining and background scheduling
- `src/lib/characters/portraits.ts`: portrait planning and Pollinations fetch
- `src/lib/auth.ts`, `src/lib/env.ts`, `src/lib/crypto.ts`: auth/env/secret handling
- `src/lib/types.ts`, `src/lib/validation.ts`: shared runtime types and Zod schemas

### Database

- `supabase/migrations/0001_baseline.sql`: full baseline schema, RLS, RPCs
- `supabase/migrations/0002_task_rls_hardening.sql`: task table RLS updates
- `supabase/migrations/0003_remove_reconcile_task_enqueue.sql`: inline continuity shift
- `supabase/migrations/0004_rewind_prunes_descendants.sql`: destructive rewind behavior

### Tests

- `src/**/*.test.ts`: unit and logic coverage
- `tests/e2e/*.spec.ts`: Playwright coverage
- `.github/workflows/ci.yml`: lint, typecheck, unit tests, and production deploy on `main`

## Task Routing Cheatsheet

### If you are changing chat generation

Read:

1. `src/app/api/chat/route.ts`
2. `src/lib/ai/thread-generation-service.ts`
3. `src/lib/threads/read-model.ts`
4. `src/lib/ai/continuity.ts`
5. `docs/architecture.md`

### If you are changing branching, rewrites, or rewind

Read:

1. `src/app/api/chats/[threadId]/branches/route.ts`
2. `src/app/api/chats/[threadId]/edit/route.ts`
3. `src/app/api/chats/[threadId]/regenerate/route.ts`
4. `src/app/api/chats/[threadId]/turns/[turnId]/rewind/route.ts`
5. `src/lib/data/branches.ts`
6. `docs/workflows.md`

### If you are changing providers or model discovery

Read:

1. `src/lib/ai/catalog.ts`
2. `src/lib/ai/provider-factory.ts`
3. `src/lib/data/connections.ts`
4. `src/app/api/providers/test/route.ts`
5. `src/app/api/providers/discover/route.ts`

### If you are changing schema or persistence

Read:

1. `docs/data-model.md`
2. the relevant migration files
3. `src/lib/supabase/database.types.ts`
4. the matching `src/lib/data/*.ts` modules

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test:unit`
- E2E tests: `pnpm test:e2e`
- Production build: `pnpm build`

## Known Current Realities

- The app runs on Next `16.2.2` and React `19.2.4`.
- `next dev --webpack` and `next build --webpack` are used by the current scripts.
- `.env.example` still includes `ENABLE_LOCAL_DEV_AUTH_BYPASS`, but the current application code does not read it.
- Continuity snapshots are generated inline after commit. The `turn_reconcile_tasks` table and worker code still exist, but they are legacy infrastructure unless intentionally reactivated.

## Documentation Upkeep

When you change any of the following, update the docs in the same task:

- route structure
- schema or RPCs
- generation flow
- provider support
- background task behavior
- required environment variables
