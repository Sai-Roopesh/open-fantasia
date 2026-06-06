# Open-Fantasia

Open-Fantasia is a private roleplay workspace for long-form AI conversations. It combines a guarded single-user app shell, user-managed provider connections, explicit personas and character sheets, threaded branching chat, inline continuity materialization, and asynchronous portrait generation.

## Documentation Map

- `AGENTS.md`: authoritative repo guide for future agents
- `docs/architecture.md`: runtime architecture, module boundaries, and request flow
- `docs/data-model.md`: schema, table relationships, RPCs, and migration notes
- `docs/workflows.md`: end-to-end user and developer workflows

## Core Capabilities

- Single-user sign-in with a hardcoded username/password
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
| Auth | Hardcoded single-user login + signed session cookie |
| Data | Supabase (Postgres, RLS, SQL RPCs) |
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
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Required by the admin client used for all app data access |
| `APP_ENCRYPTION_KEY` | Yes | Must be a 64-character hex string |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Optional | Override the hardcoded login (defaults `roops21` / `chinnu21$`) |
| `AUTH_SESSION_SECRET` | Optional | Signs the session cookie; falls back to `APP_ENCRYPTION_KEY` then a built-in constant |
| `CRON_SECRET` | Optional unless calling the internal job route | Protects `/api/internal/jobs/run` |

Generate a valid encryption key with:

```bash
openssl rand -hex 32
```

Note: `.env.example` lists only the variables the app actually reads; legacy auth-bypass and allowed-email variables have been removed.

## Database Setup

The schema lives in a single migration: `supabase/migrations/0001_baseline.sql` — a live-derived snapshot of the linked Supabase project's `public` schema plus the storage bucket and the fixed-user seed. It is the only source of truth, and the remote migration ledger records just this baseline. Future schema changes can land as new incremental migrations; if the schema is re-baselined again, regenerate `0001_baseline.sql` from Supabase and repair the remote ledger in the same pass.

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
- Thread read models are assembled in `src/lib/domain/thread-assembly.ts` and `src/lib/services/thread-reader.ts`.
- Continuity snapshots are materialized inline through `src/lib/services/continuity-service.ts` (pure extraction in `src/lib/ai/continuity.ts`) using durable branch memory plus a short recent-scene window.
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
- Chat generation issues: `src/app/api/chat/route.ts`, `src/lib/services/generation-service.ts`, `src/lib/services/continuity-service.ts`, `src/lib/ai/continuity.ts`
- Branching/rewind issues: `src/lib/data/branches.ts`, chat API routes under `src/app/api/chats/[threadId]/`
- Persistence/schema issues: `docs/data-model.md` and `supabase/migrations/`
