# Open-Fantasia

Open-Fantasia is a private roleplay workspace for long-form AI conversations. It combines a guarded Supabase-backed app shell, user-managed provider connections, explicit personas and character sheets, threaded branching chat, inline continuity materialization, and asynchronous portrait generation.

## Documentation Map

- `AGENTS.md`: authoritative repo guide for future agents
- `docs/architecture.md`: runtime architecture, module boundaries, and request flow
- `docs/data-model.md`: schema, table relationships, RPCs, and migration notes
- `docs/workflows.md`: end-to-end user and developer workflows

## Core Capabilities

- Magic-link sign-in with allowlisted access
- Persona library with a single default persona per user
- Character studio with starters, examples, generation settings, and portrait generation
- BYOK provider lanes for Google AI Studio, Groq, Mistral, OpenRouter, and Ollama-compatible endpoints
- Per-thread model and persona switching
- Streaming chat with branch creation, rewrites, regeneration, rewind, pins, ratings, and a continuity inspector
- Hybrid continuity snapshots plus timeline events for committed turns
- Protected internal job route for draining portrait work

## Stack

| Layer | Current choice |
| --- | --- |
| App framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4, Base UI, custom primitives |
| AI | Vercel AI SDK v6 |
| Auth + data | Supabase |
| Storage | Supabase Storage (`character-portraits`) |
| Transcript rendering | `@chenglou/pretext` plus custom markdown-lite parsing |
| Testing | Vitest, Playwright |
| Deploy | Vercel |

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the required environment variables.

4. Start the app:

   ```bash
   pnpm dev
   ```

5. Open `http://localhost:3000`.

## Required Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for portraits/jobs | Required by the admin client and the internal job drain |
| `ALLOWED_EMAILS` | Yes | Comma-separated bootstrapping allowlist |
| `APP_ENCRYPTION_KEY` | Yes | Must be a 64-character hex string |
| `NEXT_PUBLIC_SITE_URL` | Yes outside local dev | Used in magic-link redirects; Vercel env fallbacks also exist |
| `CRON_SECRET` | Optional unless calling the internal job route | Protects `/api/internal/jobs/run` |

Generate a valid encryption key with:

```bash
openssl rand -hex 32
```

Note: `.env.example` still contains `ENABLE_LOCAL_DEV_AUTH_BYPASS`, but the current codebase does not read it.

## Database Setup

Apply the SQL migrations in `supabase/migrations/` in order. The schema lives in six tracked migrations:

1. `0001_baseline.sql`
2. `0002_task_rls_hardening.sql`
3. `0003_remove_reconcile_task_enqueue.sql`
4. `0004_rewind_prunes_descendants.sql`
5. `0005_hybrid_memory_redesign.sql`
6. `0006_remove_turn_reconcile_tasks.sql`

The generated TypeScript bindings are checked in at `src/lib/supabase/database.types.ts`.

## Common Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
pnpm eval:hybrid-memory
pnpm test:e2e
pnpm test:e2e:list
```

Optional hybrid-memory prompt eval:

```bash
OPEN_FANTASIA_EVAL_PROVIDER=mistral \
OPEN_FANTASIA_EVAL_MODEL=mistral-medium-latest \
OPEN_FANTASIA_EVAL_API_KEY=... \
pnpm eval:hybrid-memory
```

## Architecture Snapshot

- Public routes live under `src/app/` and protected routes live under `src/app/(app)/app/`.
- Route protection is handled by `src/proxy.ts` plus `requireAllowedUser()` checks.
- Most user mutations are implemented as server actions in route-local `actions.ts` files.
- The main streaming turn path is `src/app/api/chat/route.ts`.
- Thread read models are assembled in `src/lib/threads/read-model.ts`.
- Continuity snapshots are materialized inline through `src/lib/ai/continuity.ts` using durable branch memory plus a short recent-scene window.
- Portrait jobs are queued in `character_portrait_tasks` and drained by `src/lib/jobs/task-drain.ts`.

## Background Work

- Continuity is synchronous with turn commit in current runtime behavior.
- Portrait generation remains asynchronous and is scheduled with `after()` in `src/lib/jobs/schedule-task-drain.ts`.
- The manual internal worker route remains available at `/api/internal/jobs/run`.

## Testing and CI

- Unit coverage lives next to the source in `src/**/*.test.ts`.
- Playwright coverage lives under `tests/e2e/`.
- CI runs lint, typecheck, and unit tests on pushes and pull requests to `main`.
- Production deploys are handled by the GitHub Actions workflow in `.github/workflows/ci.yml`.

## Where To Start When Debugging

- Auth/access issues: `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/env.ts`
- Provider/model issues: `src/lib/ai/catalog.ts`, `src/lib/ai/provider-factory.ts`, `src/lib/data/connections.ts`
- Chat generation issues: `src/app/api/chat/route.ts`, `src/lib/ai/thread-generation-service.ts`, `src/lib/ai/continuity.ts`
- Branching/rewind issues: `src/lib/data/branches.ts`, chat API routes under `src/app/api/chats/[threadId]/`
- Persistence/schema issues: `docs/data-model.md` and `supabase/migrations/`
