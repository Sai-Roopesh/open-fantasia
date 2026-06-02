# Architecture

This document describes the current runtime shape of Open-Fantasia as implemented in the checked-in codebase.

## System Overview

Open-Fantasia is a private Next.js App Router application with a Supabase-backed persistence layer and a Vercel AI SDK v6 chat runtime. The product is intentionally single-user in tone and workflow, but the schema still models ownership through `user_id` and RLS throughout.

The codebase is organized into five explicit layers with a strict dependency direction:

```
src/lib/utils/       — zero-dependency pure utilities (text extraction, URL safety)
src/lib/data/        — thin Supabase wrappers, no domain logic
src/lib/ai/          — pure AI: prompt building, state extraction, validation, reflection, provider factory (zero DB)
src/lib/domain/      — pure assembly, projection, and the world-state reducer (no I/O, no HTTP)
src/lib/services/    — orchestrates data + AI + domain; only layer that writes to the DB
src/app/api/         — thin routes: validate input → call service → return response
```

Each layer depends only on layers below it. Routes depend on services. Services depend on domain, AI, and data. Domain depends on data and utils for pure transformation helpers. AI depends only on utils and types. `utils/` exists so that pure helpers needed by both `data/` and `domain/` (e.g. message-text extraction, Ollama URL validation) do not force an illegal upward import into `ai/`.

## Route Structure

### Public routes

- `/`: marketing / entry page
- `/login`: username/password sign-in UI
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

- `/api/chat`: main streaming user turn endpoint (new turn, regenerate, user-edit)
- `/api/providers/test`: connection health check
- `/api/providers/discover`: model cache refresh
- `/api/chats/[threadId]/slice`: read-your-writes slice fetch (used after streaming)
- `/api/chats/[threadId]/starter`: hidden starter-seed opening
- `/api/chats/[threadId]/rewrite`: non-streaming assistant direct edit
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

- read the signed session cookie and verify it with `verifySessionToken` (`src/lib/session.ts`)
- redirect unauthenticated access to `/login`
- redirect already-authenticated users away from `/login` and into `/app`

### In-route protection

Protected route segments and server actions use `requireAllowedUser()` from `src/lib/auth.ts`. That gives code the service-role admin client, the synthetic single user, and a hard redirect to `/login` if there is no valid session.

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

The data layer contains thin Supabase query wrappers, split by domain. No orchestration lives here — only reads and writes that map closely to individual tables and RPCs.

- `src/lib/data/personas.ts`
- `src/lib/data/characters.ts`
- `src/lib/data/connections.ts`
- `src/lib/data/threads.ts`
- `src/lib/data/branches.ts`
- `src/lib/data/turns.ts`
- `src/lib/data/pins.ts`
- `src/lib/data/world-state.ts`
- `src/lib/data/timeline.ts`
- `src/lib/data/jobs.ts`

Patterns used across these modules:

- Supabase query wrappers stay close to the underlying tables and RPCs
- Zod parsing normalizes row payloads after reads
- higher-level orchestration stays in the services layer

## Domain Layer

The domain layer contains pure functions — no I/O of any kind.

- `src/lib/domain/thread-assembly.ts`: defines `ThreadAssembly` (the core domain type) and `buildThreadAssembly` (pure builder from pre-fetched raw records)
- `src/lib/domain/turn-projections.ts`: `buildTurnPath`, `buildCanonicalMessages`, `buildRecentSceneMessages`, `buildControlsByMessageId`
- `src/lib/domain/message-factory.ts`: `createTextMessage`, `truncateMessageText`
- `src/lib/domain/slice-projections.ts`: `buildInspectorView`, `buildThreadSettingsSlice`, `buildTurnSlicePatch` — all take `ThreadAssembly` + `SnapshotResolution` as explicit params
- `src/lib/domain/character-portraits.ts`: `buildCharacterPortraitPrompt`, `buildCharacterPortraitSourceHash`, `generateCharacterPortraitSeed`, `buildCharacterPortraitObjectPath`, `planCharacterPortraitState` — all pure, no I/O

### ThreadAssembly vs the old ThreadGraphView

`ThreadAssembly` is the domain type that replaces `ThreadGraphView`. The key difference is that snapshots and UI projections are no longer embedded in it:

- `ThreadAssembly` contains: thread record, branches, active branch, reachable turn path, character bundle, filtered timeline, filtered pins
- It does NOT contain: materialized snapshot, UI messages, control affordances

This decoupling means cheap mutations (rate, rewind, pin, settings changes) load the assembly without paying for snapshot materialization. The snapshot is resolved separately via `SnapshotResolution` only when needed.

## Services Layer

The services layer orchestrates domain, AI, and data. All DB writes go through here.

- `src/lib/services/thread-reader.ts`: `loadThreadAssembly` (no snapshot, used by cheap mutations) and `loadThreadAssemblyWithSnapshot` (full load including snapshot, used by generation and page renders). Also contains the private `resolveSnapshotForAssembly` helper.
- `src/lib/services/slice-service.ts`: `buildSliceResponse` (returns a `Response`) and `buildSlicePatch` (returns a `TurnSlicePatch`) — the single unified read-your-writes builder used by all mutation routes and server actions
- `src/lib/services/continuity-service.ts`: `materializeSnapshotForTurn` — the HCE write pipeline (ancestor walk, extraction via AI layer, DB mutation application, snapshot persistence)
- `src/lib/services/generation-runtime.ts`: `GenerationRuntime` type and `loadGenerationRuntime` — loads everything needed to generate a turn; holds `SnapshotResolution` as an immutable field (never mutated in place)
- `src/lib/services/generation-service.ts`: `streamNewTurn`, `streamRewriteTurn` (streaming), `rewriteLatestTurn`, `generateStarterTurn` (non-streaming), `generateReply` — owns the full turn lifecycle including commit and continuity materialization
- `src/lib/services/connections.ts`: `testConnectionHealth`, `refreshConnectionModels` (external API + DB write), `saveConnectionWithValidation`, `deleteConnectionSafely` — connection orchestration that involves external API calls
- `src/lib/services/characters.ts`: `saveCharacterWithPortrait`, `regenerateCharacterPortrait`, `startThread` — character and thread creation orchestration including portrait job enqueueing
- `src/lib/services/thread-settings-service.ts`: `switchThreadModel`, `switchThreadBrainModel`, `switchThreadPersona`, `switchThreadTokens`, `switchThreadBranch` — settings mutation orchestration called by server actions

## AI Layer

The AI layer contains pure functions with zero DB writes.

- `src/lib/ai/continuity.ts`: `runContinuityExtraction` — pure extraction orchestrator that calls `extractStateChanges`, validates, optionally reflects, strips invalid mutations, and returns a clean `ExtractionOutput`. Zero DB calls.
- `src/lib/ai/state-extraction.ts`: LLM-based structured state extraction
- `src/lib/ai/state-validator.ts`: validates LLM-emitted mutations against the current snapshot
- `src/lib/ai/state-reflector.ts`: dual-pass reflection for failed extractions
- `src/lib/ai/roleplay-prompt.ts`: `buildRoleplaySystemPrompt` — pure prompt builder. Stable character/persona/directives form the prompt prefix; dynamic world-state/pins/timeline are appended last to maximize provider prompt-cache hits. Persona is optional (the `<user_persona>` block is omitted when absent).
- `src/lib/ai/generation-helpers.ts`: `ThreadGenerationServiceError`, `toThreadGenerationErrorResponse`, `buildGenerationMessages`, `buildGenerationSystemPrompt`, `assertBranchReadyForNewTurn`, `assertBranchReadyForRewrite`, `assertLatestTurnRewriteTarget`
- `src/lib/ai/generation-settings.ts`: `resolveThreadGenerationSettings`
- `src/lib/ai/provider-factory.ts`: `createLanguageModel`
- `src/lib/ai/catalog.ts`: provider and model catalog

## Chat Generation Lifecycle

The main chat route at `src/app/api/chat/route.ts` is a thin dispatcher (~70 lines). It validates the request and delegates to `streamNewTurn` or `streamRewriteTurn` in `src/lib/services/generation-service.ts`.

### Normal user turn (`mode: "new"`)

1. Authenticate with `getCurrentUser()`.
2. Validate request body with Zod.
3. Delegate to `streamNewTurn` in `generation-service.ts`.
4. Inside `streamNewTurn`: load `GenerationRuntime` via `loadGenerationRuntime`.
5. Assert the active branch is not generation-locked.
6. Reserve a turn with the `begin_turn` RPC wrapper.
7. Mark the turn as `streaming`.
8. Build the system prompt from character, persona, head snapshot, pins, and filtered timeline.
9. Send the recent-scene window plus the new user turn to `streamText(...)`.
10. On success (`onFinish`): `commitTurn` → `materializeSnapshotForTurn`.
11. On failure (`onError`): `failTurn`.

### Rewrite turns (`mode: "regenerate"` or `mode: "user"`)

Handled by `streamRewriteTurn` in `generation-service.ts`. The flow is the same as a new turn except:

- The existing latest turn is asserted as the current head before reserving
- The new turn is parented to the replaced turn's parent (replacing the old head in the chain)
- The system prompt uses the parent's snapshot instead of the current head snapshot

### Non-streaming rewrite (`mode: "assistant"`)

Handled by `src/app/api/chats/[threadId]/rewrite/route.ts`. It uses `generateReply` (non-streaming) from `generation-service.ts` and returns a slice response instead of a stream.

### Starter generation

The starter route is only allowed before the first visible turn. It uses `generateReply` (non-streaming), inserts a hidden `starter_seed` user message, generates the opening assistant reply, logs a timeline event, and materializes a snapshot.

## Continuity Architecture

Continuity is handled by the Hybrid Continuity Engine (HCE). World state for a
turn is stored as a single `DurableMemorySnapshot` **JSONB blob** on the
`world_snapshots` row — the snapshot IS the source of truth. There are no
normalized `world_*` tables; the previous 7-table bi-temporal model was replaced
because applying one turn meant ~30 sequential, transaction-less writes.

Snapshots are keyed by `turn_id` (not `turn_id + branch_id`). Because branches
share their ancestor turns, a forked branch transparently reads the shared
ancestor snapshot and only writes fresh snapshots for its own divergent turns —
fork isolation with no copy step.

**AI layer (pure, no DB):**
- `src/lib/ai/continuity.ts`: `runContinuityExtraction` — extraction → validation → optional reflection → strip invalid mutations → clean `ExtractionOutput`
- `src/lib/ai/state-extraction.ts`, `state-validator.ts`, `state-reflector.ts`

**Domain layer (pure transforms):**
- `src/lib/domain/world-state-reducer.ts`: `applyExtractionToSnapshot` — pure `(previous snapshot, extraction) → next snapshot`. Replaces the old `applyMutationsToDb`.
- `src/lib/domain/world-snapshot.ts`: `parseWorldSnapshot` (reads the blob off a row), `buildEmptyDurableSnapshot`

**Services layer (DB writes):**
- `src/lib/services/continuity-service.ts`: `materializeSnapshotForTurn`

For a committed turn, `materializeSnapshotForTurn` does:

1. Load all turns for the thread and build the reachable path
2. Find the nearest ancestor snapshot in a single `turn_id = ANY(...)` query
3. Parse the previous snapshot blob (or build an empty one)
4. Call `runContinuityExtraction` (AI layer) → validated `ExtractionOutput`
5. Apply it in memory via `applyExtractionToSnapshot` (domain)
6. Persist with one atomic `upsert_world_snapshot` RPC call
7. Insert any timeline events (resolving `NEW:` entity refs)
8. Every 10 committed turns, run a full re-materialization (defragmentation) pass

If extraction fails, the fallback carries the previous snapshot forward via a
single atomic upsert — no partial state is ever possible.

**Atomicity**: a turn's entire world-state change is one JSONB upsert, so a crash
mid-apply can no longer leave world state partially written. Snapshot reads are a
pure blob parse and cannot partially fail, so there is no materialization-error
state to surface in the UI.

**Turn replacement**: on rewrite/regenerate the new turn re-parents to the
replaced turn's parent and `commit_turn(p_replace_turn_id)` deletes the replaced
turn; its snapshot cascades away (`ON DELETE CASCADE`), so replacements leave no
orphaned turns or snapshots.

## Branching, Rewind, and Destructive Semantics

### Branch creation

Branch creation is implemented by the `create_branch_from_turn` SQL function and exposed through `src/app/api/chats/[threadId]/branches/route.ts`.

Key rules:

- the source turn must be visible on the active path
- a new branch records `parent_branch_id` and `fork_turn_id`
- the new branch head starts on the fork turn
- branch creation can optionally make the new branch active

### Rewind

Rewind is intentionally destructive in the current baseline schema.

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

Threads persist the chosen `connection_id` and `model_id`, and the chat page supports switching those later through server actions.

## Portrait Pipeline

Portrait behavior is spread across three layers, following the layer contract:

### Planning (domain layer)

`src/lib/domain/character-portraits.ts` contains pure functions:

- `planCharacterPortraitState()` — decides whether a new portrait is needed and what the next state should be
- `buildCharacterPortraitPrompt()` — builds the Pollinations prompt from character fields
- `buildCharacterPortraitSourceHash()` — stable hash of the portrait-driving fields
- `buildCharacterPortraitObjectPath()` — constructs the storage object path

### Portrait URL resolution (data layer)

`resolveCharacterPortraitUrl()` in `src/lib/data/characters.ts` resolves a Supabase storage public URL from a portrait path.

### Orchestration (services layer)

`src/lib/services/characters.ts` contains `saveCharacterWithPortrait()` and `regenerateCharacterPortrait()`, which combine portrait planning with character persistence and task enqueueing.

### Execution (jobs layer)

Portrait tasks are queued from character server actions. Task draining happens in `src/lib/jobs/task-drain.ts` and:

- claims runnable portrait tasks
- fetches the image from Pollinations via `src/lib/jobs/portrait-fetch.ts`
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
- `src/lib/services/generation-service.ts`
- `src/lib/services/generation-runtime.ts`
- `src/lib/services/continuity-service.ts`
- `src/lib/domain/thread-assembly.ts`
- `src/lib/services/thread-reader.ts`
- `src/app/(app)/app/chats/[threadId]/page.tsx`
- `supabase/migrations/0001_baseline.sql`
