# Architecture

This document describes the current runtime shape of Open-Fantasia as implemented in the checked-in codebase.

## System Overview

Open-Fantasia is a private Next.js App Router application with a Supabase-backed persistence layer and a Vercel AI SDK v6 chat runtime. The product is intentionally single-user in tone and workflow, but the schema still models ownership through `user_id` and RLS throughout.

The main architecture layers are:

1. App shell and route protection
2. Domain-specific server actions and API routes
3. Read/write data modules over Supabase
4. AI generation and continuity materialization
5. Optional background task draining for portraits

## Route Structure

### Public routes

- `/`: marketing / entry page
- `/login`: magic-link request UI
- `/auth/callback`: Supabase auth completion
- `/auth/signout`: session clear path

### Protected app routes

All protected routes live under `src/app/(app)/app/` and are wrapped by the protected layout.

- `/app`: dashboard and readiness checklist
- `/app/personas`: persona management
- `/app/characters`: character library and studio
- `/app/threads`: thread library and archival state
- `/app/chats/[threadId]`: active chat workspace
- `/app/settings/providers`: provider lanes and model discovery

### API routes

- `/api/chat`: main streaming user turn endpoint
- `/api/providers/test`: connection health check
- `/api/providers/discover`: model cache refresh
- `/api/chats/[threadId]/starter`: hidden starter-seed opening
- `/api/chats/[threadId]/rewrite`: replace the latest branch head by rewriting the latest user turn, rewriting the latest assistant reply, or regenerating the latest assistant reply
- `/api/chats/[threadId]/branches`: create a new branch from a visible turn
- `/api/chats/[threadId]/pins`: create a pin from a visible turn
- `/api/chats/[threadId]/pins/[pinId]`: resolve an active pin
- `/api/chats/[threadId]/turns/[turnId]/rewind`: rewind the active branch to an earlier reachable turn
- `/api/chats/[threadId]/turns/[turnId]/rate`: save feedback rating
- `/api/internal/jobs/run`: protected manual task drain endpoint

## Authentication and Access Control

### Request-time protection

`src/proxy.ts` is the first request-time guard for `/app/*` and `/login`.

Its responsibilities are:

- hydrate a Supabase server client from cookies
- resolve the current user
- ensure a `profiles` row exists
- seed `profiles.is_allowed` from `ALLOWED_EMAILS` for first-time users
- redirect unauthorized access to `/login`
- redirect already-authorized users away from `/login` and into `/app`

### In-route protection

Protected route segments and server actions use `requireAllowedUser()` from `src/lib/auth.ts`. That gives code a server client, the authenticated user, and a hard redirect if the user is not allowed.

## UI Composition

### Root layout

`src/app/layout.tsx` sets fonts, metadata, and the global body wrapper.

### Protected layout

`src/app/(app)/app/layout.tsx` loads recent threads for the shell and wraps the workspace in:

- `TransitionProvider`
- `GlobalLoadingBar`
- `AppShell`

### Chat workspace

The chat page is assembled in `src/app/(app)/app/chats/[threadId]/page.tsx` and rendered through `src/components/chat/chat-workspace.tsx`.

Notable UI responsibilities:

- optimistic branch / model / persona switching
- composer state and failed-draft recovery
- transcript rendering
- continuity inspector tabs
- focus mode
- action sheets for branch, edit, pin, rewind, and rating workflows

The transcript itself is rendered by `src/components/chat/pretext-transcript.tsx`, which uses a lightweight markdown parser plus custom styling. Lower-level Pretext layout helpers live in `src/lib/pretext/layout.ts`.

## Data Layer Structure

The data layer is intentionally split by domain:

- `src/lib/data/personas.ts`
- `src/lib/data/characters.ts`
- `src/lib/data/connections.ts`
- `src/lib/data/threads.ts`
- `src/lib/data/branches.ts`
- `src/lib/data/turns.ts`
- `src/lib/data/pins.ts`
- `src/lib/data/snapshots.ts`
- `src/lib/data/timeline.ts`
- `src/lib/data/jobs.ts`

Patterns used across these modules:

- Supabase query wrappers stay close to the underlying tables and RPCs
- Zod parsing normalizes row payloads after reads
- higher-level orchestration stays in route handlers or dedicated service modules

## Thread Read Model

`src/lib/threads/read-model.ts` is the core assembly layer for chat runtime state.

It builds a `ThreadGraphView` containing:

- the thread record
- all branches
- the active branch
- all turns
- the latest reachable turn
- the character bundle
- the best available head snapshot
- timeline events
- active pins
- transcript-ready messages
- recent-scene model-context messages
- per-message control affordances

This read model is the shared foundation for:

- chat page rendering
- generation runtime loading
- branch and rewind eligibility checks
- pinning and rating validation

## Chat Generation Lifecycle

The main flow lives in `src/app/api/chat/route.ts`.

### Normal user turn

1. Authenticate with `getCurrentUser()`.
2. Validate the request body with Zod.
3. Load the thread runtime via `loadThreadGenerationRuntime(...)`.
4. Assert the active branch is not already locked.
5. Reserve a turn with the `begin_turn` RPC wrapper.
6. Mark the turn as `streaming`.
7. Build the system prompt from character, persona, hybrid memory snapshot, pins, and filtered timeline state.
8. Send only the recent-scene window plus the new user turn to `streamText(...)`.
9. On success, persist with `commit_turn`.
10. Immediately materialize the new continuity snapshot.
11. On failure, persist failure state with `fail_turn`.

### Latest-turn rewrites

The rewrite route does not stream responses to the browser. It:

- loads the same generation runtime
- asserts the branch is in a rewrite-safe state
- reserves a replacement turn
- replaces the current head in one of three modes: regenerate the latest assistant reply, rewrite the latest user turn and regenerate, or rewrite the latest assistant reply directly
- commits the replacement turn
- materializes a fresh snapshot inline

### Starter generation

The starter route is only allowed before the first visible turn. It inserts a hidden user prompt marked as `starter_seed`, generates the opening assistant reply, logs a timeline event, and saves the resulting snapshot.

## Continuity Architecture

Continuity is handled by `src/lib/ai/continuity.ts` and `src/lib/ai/thread-engine.ts`.

For a committed turn, the runtime tries to:

1. load any existing snapshot
2. recursively materialize the parent snapshot if needed
3. combine the previous snapshot with the last 10 committed turns on the reachable path
4. ask the reconciliation engine for updated durable branch memory plus current-scene state
5. persist the snapshot
6. optionally persist a generated timeline event

If reconciliation fails, the system falls back to a deterministic snapshot builder instead of leaving the branch without state. Normal generation still uses a short recent-scene transcript window instead of replaying the whole branch transcript every turn.

The chat page still treats a missing or failed head snapshot as a first-class condition. When the head snapshot is pending or failed, the composer blocks new progress until the branch state is coherent again.

## Branching, Rewind, and Destructive Semantics

### Branch creation

Branch creation is implemented by the `create_branch_from_turn` SQL function and exposed through `src/app/api/chats/[threadId]/branches/route.ts`.

Key rules:

- the source turn must be visible on the active path
- a new branch records `parent_branch_id` and `fork_turn_id`
- the new branch head starts on the fork turn
- branch creation can optionally make the new branch active

### Rewind

Rewind is intentionally destructive after migration `0004_rewind_prunes_descendants.sql`.

Current behavior:

- the target turn must be reachable from the current head
- the branch cannot be generation-locked
- the branch head moves back to the target turn
- descendant turns past the rewind point are deleted
- sibling branches rooted in the deleted subtree are also deleted

Any feature work touching rewind must preserve that destructive pruning contract unless the schema and docs are updated together.

## Provider and Model Architecture

Provider metadata is defined in `src/lib/ai/catalog.ts`.

Supported providers:

- Google AI Studio
- Groq
- Mistral
- OpenRouter
- Ollama Cloud or remote Ollama-compatible endpoints

Runtime model creation is centralized in `src/lib/ai/provider-factory.ts`. Stored connection secrets are decrypted there using `src/lib/crypto.ts`.

Provider routes support two operational flows:

- connection testing
- model discovery / cache refresh

Threads persist the chosen `connection_id` and `model_id`, and the chat page also supports switching those later through server actions.

## Portrait Pipeline

Portrait behavior is split in two parts.

### Planning

`src/lib/characters/portraits.ts` determines whether a portrait should be regenerated when a character changes. It derives:

- the prompt
- a content hash
- the generation seed
- the next portrait state

### Execution

Portrait tasks are queued from character server actions. Task draining happens in `src/lib/jobs/task-drain.ts` and:

- claims runnable portrait tasks
- fetches the image from Pollinations
- uploads it into Supabase storage
- updates the character portrait fields
- retries with backoff on failure

`src/lib/jobs/schedule-task-drain.ts` schedules opportunistic draining with `after()`, and `/api/internal/jobs/run` provides a manual drain path protected by `CRON_SECRET`.

## Testing and Deployment

### Tests

- unit logic tests are colocated with source
- end-to-end smoke coverage lives under `tests/e2e`

### CI

`.github/workflows/ci.yml` runs:

1. install
2. lint
3. typecheck
4. unit tests

On `main`, the workflow then builds and deploys to Vercel production.

## Source File Shortlist

If you only have time to read a few files before making a change, these give the fastest accurate orientation:

- `src/proxy.ts`
- `src/lib/auth.ts`
- `src/app/api/chat/route.ts`
- `src/lib/ai/thread-generation-service.ts`
- `src/lib/ai/continuity.ts`
- `src/lib/threads/read-model.ts`
- `src/app/(app)/app/chats/[threadId]/page.tsx`
- `supabase/migrations/0001_baseline.sql`
