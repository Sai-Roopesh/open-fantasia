# Workflows

This document captures the main product and maintenance workflows that future agents are most likely to touch.

## 1. First-Time Workspace Setup

### Goal

Get a brand-new user from no data to a usable thread.

### Expected path

1. User requests a magic link from `/login`.
2. Supabase callback lands at `/auth/callback`.
3. `src/proxy.ts` ensures a `profiles` row exists and checks allowlist status.
4. The protected dashboard (`/app`) shows readiness state.
5. User creates a default persona.
6. User saves at least one provider connection.
7. User tests that connection and refreshes models.
8. User creates a character sheet.
9. User starts a thread.

### Key files

- `src/app/login/actions.ts`
- `src/proxy.ts`
- `src/app/(app)/app/page.tsx`
- `src/app/(app)/app/personas/actions.ts`
- `src/app/(app)/app/settings/providers/actions.ts`
- `src/app/(app)/app/characters/actions.ts`

## 2. Login and Authorization

### What happens

- The login form submits to `requestMagicLink(...)`.
- `NEXT_PUBLIC_SITE_URL` determines the email redirect target.
- After auth completes, app code creates or updates the `profiles` record.
- Access to `/app/*` depends on `profiles.is_allowed`.

### Important nuance

`ALLOWED_EMAILS` is only the bootstrap rule used when creating a new profile. Once the row exists, the live source of truth is the `profiles.is_allowed` value in the database.

## 3. Provider Lane Setup

### User flow

1. Save a provider connection.
2. Run the connection test.
3. Refresh models for that connection.
4. Optionally mark a default model by saving it on the connection.
5. Start a thread against that connection and model.

### Validation rules

- provider labels are required
- some providers require recognizable API key formats
- Ollama only requires an API key when targeting hosted Ollama Cloud-style URLs

### Key files

- `src/lib/ai/catalog.ts`
- `src/lib/ai/provider-factory.ts`
- `src/app/api/providers/test/route.ts`
- `src/app/api/providers/discover/route.ts`
- `src/lib/data/connections.ts`

## 4. Persona Management

### Supported actions

- create persona
- update persona
- duplicate persona
- delete persona
- set default persona

### Important invariant

Only one persona can be the default per user. That rule is enforced both in data design and through the `set_default_persona` SQL function.

### Key files

- `src/app/(app)/app/personas/actions.ts`
- `src/lib/data/personas.ts`

## 5. Character Management and Portraits

### Supported actions

- create or edit a character
- change generation settings such as temperature, top-p, and max output tokens
- attach starters and example conversations
- delete a character
- regenerate the portrait

### Portrait behavior

- portrait planning happens during character save
- appearance is the main requirement for portrait generation
- a stable source hash determines whether a new portrait is needed
- new portrait tasks are queued in `character_portrait_tasks`
- `after()` opportunistically drains those tasks

### Key files

- `src/app/(app)/app/characters/actions.ts`
- `src/lib/characters/portraits.ts`
- `src/lib/data/characters.ts`
- `src/lib/data/jobs.ts`
- `src/lib/jobs/task-drain.ts`

## 6. Starting a Thread

### Preconditions

- the selected character must exist
- a persona must be chosen, or a default persona must exist
- a usable connection must exist
- the selected connection must have a cached model that matches the requested or default `model_id`

### What the action does

- creates a `chat_threads` row
- creates a `Main` active branch for that thread
- redirects to `/app/chats/[threadId]`

### Key files

- `src/app/(app)/app/characters/actions.ts`
- `src/lib/data/threads.ts`

## 7. Sending the First Starter Opening

### Purpose

Before the first visible turn, the user can seed the opening scene with hidden guidance rather than literal dialogue.

### Behavior

- only available when the thread has zero turns
- stored as a hidden user input marked `starter_seed`
- assistant generates an in-character opening
- a timeline event is written
- a continuity snapshot is materialized immediately

### Key file

- `src/app/api/chats/[threadId]/starter/route.ts`

## 8. Normal Chat Turn

### Flow

1. Client `useChat(...)` sends the latest user message to `/api/chat`.
2. Server loads the thread runtime and asserts branch readiness.
3. Server reserves a turn and locks the active branch.
4. AI SDK streams the assistant reply from the hybrid prompt context: durable branch memory, current-scene memory, filtered pins/timeline, and the last 4 committed turns of exact transcript context plus the new user message.
5. On finish, the turn is committed.
6. Continuity is materialized inline from the parent snapshot plus the last 10 committed turns on the active path.
7. The client refreshes the page state.

### Files to inspect

- `src/components/chat/chat-workspace.tsx`
- `src/app/api/chat/route.ts`
- `src/lib/ai/thread-generation-service.ts`
- `src/lib/ai/continuity.ts`

## 9. Rewriting the Latest Turn

Use when the user wants to replace the current branch head without branching.

Supported modes:

- regenerate the latest turn: keeps the latest user input, generates a fresh assistant reply from the parent snapshot, and commits a replacement head turn
- rewrite latest user turn: replaces the latest visible user message, generates a fresh assistant reply from the parent snapshot, and commits a replacement head turn
- rewrite latest assistant turn: keeps the same latest user input, commits edited assistant text directly, and materializes a fresh snapshot so continuity reflects the rewritten reply

### Important safety rule

The rewrite flow only operates when the active branch and current head still match the values supplied by the client.

### Key files

- `src/app/api/chats/[threadId]/rewrite/route.ts`

## 10. Branching

### User intent

Fork the conversation from a visible turn without losing the current branch.

### Rules

- the source turn must be on the visible active path
- the new branch records parent and fork metadata
- it may become the active branch immediately
- a timeline event is created on branch creation

### Key files

- `src/app/api/chats/[threadId]/branches/route.ts`
- `src/lib/data/branches.ts`

## 11. Rewind

### User intent

Return the active branch to an earlier turn and discard everything after it.

### Current semantics

- only reachable turns can be rewind targets
- the active branch must not be generation-locked
- rewinding deletes descendant turns
- rewinding also deletes sibling branches that live entirely inside the deleted subtree

This is intentionally destructive behavior and should not be softened accidentally.

### Key files

- `src/app/api/chats/[threadId]/turns/[turnId]/rewind/route.ts`
- `src/lib/data/branches.ts`
- `supabase/migrations/0004_rewind_prunes_descendants.sql`

## 12. Pins, Ratings, and Continuity Inspector

### Pins

- pins can only be created from turns on the visible active path
- resolving a pin changes its status instead of deleting the record

### Ratings

- ratings are saved per turn
- the UI currently expects a 1-4 scale

### Continuity inspector

The chat page surfaces:

- story summary
- current scene
- last beat
- relationship state
- active threads
- resolved threads
- next pressure
- scene goals
- durable user facts
- branch metadata
- timeline events
- active pins

### Key files

- `src/app/api/chats/[threadId]/pins/route.ts`
- `src/app/api/chats/[threadId]/pins/[pinId]/route.ts`
- `src/app/api/chats/[threadId]/turns/[turnId]/rate/route.ts`
- `src/app/(app)/app/chats/[threadId]/page.tsx`

## 13. Switching Model, Persona, or Branch Mid-Thread

These are server-action based mutations triggered from the chat workspace.

### Model switch

- validates the chosen connection exists
- validates the model is present in that connection's cached models
- updates the thread
- writes a timeline event

### Persona switch

- validates the persona exists
- updates the thread
- writes a timeline event

### Branch switch

- activates the target branch through SQL
- revalidates the chat page

### Key file

- `src/app/(app)/app/chats/[threadId]/actions.ts`

## 14. Background Job Drain

### Current practical use

Portrait generation is the active reason to drain jobs.

### Entry points

- automatic: `scheduleTaskDrain(...)` with `after()`
- manual: `POST /api/internal/jobs/run` with `Authorization: Bearer ${CRON_SECRET}`

### Important note

The task drain is portrait-only. Continuity snapshots are no longer queued in the background.

## 15. Troubleshooting Guide

### Symptom: user gets bounced back to login

Inspect:

- `src/proxy.ts`
- `src/lib/auth.ts`
- `profiles.is_allowed`
- public Supabase env vars

### Symptom: chat composer is blocked after a turn

Inspect:

- chat page continuity status
- `src/lib/ai/continuity.ts`
- whether the latest committed turn has a reachable snapshot
- branch lock state in `chat_branches`

### Symptom: provider looks saved but chat cannot use it

Inspect:

- `health_status`
- `default_model_id`
- `model_cache`
- secret decryption path in `src/lib/crypto.ts`

### Symptom: portrait stays pending or failed

Inspect:

- `character_portrait_tasks`
- `src/lib/jobs/task-drain.ts`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` if using the internal worker route

### Symptom: rewind removed more history than expected

Inspect:

- `docs/data-model.md`
- migration `0004_rewind_prunes_descendants.sql`

The current destructive pruning is intentional.
