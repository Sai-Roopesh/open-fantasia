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

- `/app` is private. Access is gated through `src/proxy.ts`, which verifies a signed session cookie (`src/lib/session.ts`).
- Auth is a single hardcoded credential (`src/lib/auth-config.ts`); there is no Supabase Auth and no sign-up. The lone user is synthetic (`FIXED_USER_ID`) and app data is read/written through the service-role admin client, which bypasses RLS. `auth.uid()` RLS policies remain but are no longer the gate.
- Every live thread must carry an explicit `character_id`, `connection_id`, and `model_id`. `persona_id` is optional — a thread can run on the character sheet alone (the no-inherent-assumptions philosophy).
- World state is a single `DurableMemorySnapshot` JSONB blob per turn on `world_snapshots`, keyed by `turn_id`. There are no normalized `world_*` tables. A turn's continuity write is one atomic `upsert_world_snapshot` RPC; the pure reducer is `src/lib/domain/world-state-reducer.ts`.
- Every thread has exactly one active branch.
- Branch generation is serialized with `generation_locked` and `locked_by_turn_id`.
- New turns, rewrites, and regenerations all end by materializing a continuity snapshot inline with `materializeSnapshotForTurn(...)`.
- If the latest committed turn does not have a usable head snapshot, the chat UI blocks further progress until the branch is repaired.
- Character portraits are asynchronous and run through `character_portrait_tasks`; continuity snapshots are no longer queued in normal operation.
- Provider secrets are encrypted with AES-256-GCM via `APP_ENCRYPTION_KEY`, which must be a 64-character hex string.
- The repo keeps a single live-derived baseline at `supabase/migrations/0001_baseline.sql`; if schema history is reset, regenerate that file from the linked Supabase project and repair remote migration history in the same pass.

## Where Things Live

### UI and routing

- `src/app/page.tsx`: public landing page
- `src/app/login/*`: username/password login flow
- `src/app/auth/signout/*`: session clear path
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
- `src/app/api/chats/[threadId]/*`: branch, rewrite, starter, rewind, pins, rating
- `src/app/api/providers/*`: test connection and refresh model cache
- `src/app/api/internal/jobs/run/route.ts`: protected task drain endpoint

### Domain and data layer

The codebase has four internal library layers with a strict dependency direction (routes → services → domain/AI → data):

**Data layer** (`src/lib/data/*`) — thin Supabase wrappers, no orchestration:
- `src/lib/data/turns.ts`, `branches.ts`, `threads.ts`, `characters.ts`, `connections.ts`, `personas.ts`, `pins.ts`, `world-state.ts`, `timeline.ts`, `jobs.ts`

**AI layer** (`src/lib/ai/*`) — pure AI functions, zero DB writes:
- `src/lib/ai/continuity.ts`: `runContinuityExtraction` (pure extraction orchestrator)
- `src/lib/ai/generation-helpers.ts`: guard functions, error types, prompt building
- `src/lib/ai/state-extraction.ts`, `state-validator.ts`, `state-reflector.ts`
- `src/lib/ai/roleplay-prompt.ts`, `provider-factory.ts`, `catalog.ts`, `generation-settings.ts`

**Domain layer** (`src/lib/domain/*`) — pure assembly and projection, no I/O:
- `src/lib/domain/thread-assembly.ts`: `ThreadAssembly` type, `buildThreadAssembly`
- `src/lib/domain/turn-projections.ts`: `buildTurnPath`, `buildCanonicalMessages`, `buildRecentSceneMessages`, `buildControlsByMessageId`
- `src/lib/domain/slice-projections.ts`: `buildInspectorView`, `buildThreadSettingsSlice`, `buildTurnSlicePatch`
- `src/lib/domain/message-factory.ts`: `createTextMessage`
- `src/lib/domain/character-portraits.ts`: `planCharacterPortraitState`, `buildCharacterPortraitPrompt`, `buildCharacterPortraitSourceHash`, `buildCharacterPortraitObjectPath`

**Services layer** (`src/lib/services/*`) — orchestration and all DB writes:
- `src/lib/services/thread-reader.ts`: `loadThreadAssembly`, `loadThreadAssemblyWithSnapshot`
- `src/lib/services/slice-service.ts`: `buildSliceResponse`, `buildSlicePatch`
- `src/lib/services/continuity-service.ts`: `materializeSnapshotForTurn`
- `src/lib/services/generation-runtime.ts`: `GenerationRuntime` type, `loadGenerationRuntime`
- `src/lib/services/generation-service.ts`: `streamNewTurn`, `streamRewriteTurn`, `rewriteLatestTurn`, `generateStarterTurn`, `generateReply`
- `src/lib/services/connections.ts`: `testConnectionHealth`, `refreshConnectionModels`, `saveConnectionWithValidation`, `deleteConnectionSafely`
- `src/lib/services/characters.ts`: `saveCharacterWithPortrait`, `regenerateCharacterPortrait`, `startThread`
- `src/lib/services/thread-settings-service.ts`: settings mutation orchestration

**Support modules:**
- `src/lib/jobs/*`: task draining, background scheduling, and the external Pollinations portrait fetch (`portrait-fetch.ts`); pure portrait logic is in `src/lib/domain/character-portraits.ts`
- `src/lib/auth.ts`, `src/lib/env.ts`, `src/lib/crypto.ts`: auth/env/secret handling
- `src/lib/types.ts`, `src/lib/validation.ts`: shared runtime types and Zod schemas

### Database

- `supabase/migrations/0001_baseline.sql`: full live-derived baseline schema, RLS, storage bucket config, and RPCs

### Tests

- `src/**/*.test.ts`: unit and logic coverage
- `tests/e2e/*.spec.ts`: Playwright coverage
- `.github/workflows/ci.yml`: lint, typecheck, unit tests, and production deploy on `main`

## Task Routing Cheatsheet

### If you are changing chat generation

Read:

1. `src/app/api/chat/route.ts`
2. `src/lib/services/generation-service.ts`
3. `src/lib/services/generation-runtime.ts`
4. `src/lib/services/continuity-service.ts`
5. `src/lib/ai/continuity.ts`
6. `docs/architecture.md`

### If you are changing branching, rewrites, or rewind

Read:

1. `src/app/api/chats/[threadId]/branches/route.ts`
2. `src/app/api/chats/[threadId]/rewrite/route.ts`
3. `src/app/api/chats/[threadId]/turns/[turnId]/rewind/route.ts`
4. `src/lib/data/branches.ts`
5. `src/lib/services/generation-service.ts` (for streaming rewrites)
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
- `.env.example` lists only the variables the app reads (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, `AUTH_USERNAME`/`AUTH_PASSWORD`/`AUTH_SESSION_SECRET`). The legacy `ENABLE_LOCAL_DEV_AUTH_BYPASS` and `ALLOWED_EMAILS` vars are gone.
- Continuity snapshots are generated inline after commit. `turn_reconcile_tasks` no longer exists in the baseline schema; portrait draining is the only background task queue.
- There is no `src/lib/threads/` directory. The old `read-model.ts` god module has been replaced by `src/lib/domain/thread-assembly.ts`, `src/lib/domain/slice-projections.ts`, and `src/lib/services/thread-reader.ts`.
- There is no `src/lib/ai/thread-generation-service.ts`. Generation is handled by `src/lib/services/generation-service.ts` and `src/lib/services/generation-runtime.ts`. Pure helper functions and error types live in `src/lib/ai/generation-helpers.ts`.
- There is no `src/lib/characters/portraits.ts`. Portrait pure logic is in `src/lib/domain/character-portraits.ts`, portrait URL resolution is in `src/lib/data/characters.ts`, and the external Pollinations fetch is in `src/lib/jobs/portrait-fetch.ts`.
- `src/lib/ai/continuity.ts` is now a pure extraction orchestrator (no DB writes). All HCE persistence is in `src/lib/services/continuity-service.ts`.
- World state is JSONB, not normalized tables. `src/lib/ai/state-materializer.ts` is gone; snapshot reads are a pure blob parse in `src/lib/domain/world-snapshot.ts` (`parseWorldSnapshot`), and mutations apply in memory via `src/lib/domain/world-state-reducer.ts` before one atomic `upsert_world_snapshot` RPC. Migrations `0005`–`0007` add the `world_state` column, the RPCs (`upsert_world_snapshot`, `create_thread_with_branch`, `commit_turn(p_replace_turn_id)`), and drop the legacy `world_*` tables. `0008` decouples `profiles` from Supabase Auth and seeds the fixed user; `0009` makes every ownership RPC (`begin_turn`, `commit_turn`, `fail_turn`, `create_branch_from_turn`, `rewind_branch_to_turn`, `activate_branch`, `set_default_persona`, `create_thread_with_branch`) take an explicit `p_user_id` — `auth.uid()` is NULL under the service-role client, so RPCs must never gate on it.
- Pure utilities shared across layers live in `src/lib/utils/` (`message-text.ts`, `url-safety.ts`). Route logic for branch/pin/rewind/rating lives in dedicated services (`branch-service.ts`, `pin-service.ts`, `rewind-service.ts`, `rating-service.ts`).
- Note: `src/lib/supabase/database.types.ts` is hand-maintained, not freshly generated. The current `supabase gen types` CLI build emits over-strict (non-null) types for nullable RPC params, which breaks the `?? null` RPC call sites. The committed file matches the live schema (only `world_snapshots` under `world_*`, JSONB `world_state`, the new RPCs) with correct nullability. If you regenerate, re-apply the nullable-RPC-param fixups.
- `src/lib/data/connections.ts` contains only thin Supabase wrappers. `testConnectionHealth()` and `refreshConnectionModels()` live in `src/lib/services/connections.ts`.
- Cheap mutations (rate, rewind, pin, settings) use `loadThreadAssembly` — they do not trigger snapshot materialization. Only generation, page renders, and the continuity polling slice use `loadThreadAssemblyWithSnapshot`.

## Documentation Upkeep

When you change any of the following, update the docs in the same task:

- route structure
- schema or RPCs
- generation flow
- provider support
- background task behavior
- required environment variables
