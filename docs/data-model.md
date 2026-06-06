# Data Model

This document explains the current persisted model for Open-Fantasia, including tables, relationships, SQL functions, and migration notes that matter during feature work.

## Schema Overview

The schema lives in a single migration: `supabase/migrations/0001_baseline.sql` — a live-derived snapshot of the linked Supabase project's `public` schema plus the storage bucket and the fixed-user seed. It is the only source of truth; the remote migration ledger records only this baseline, so the migration file, the ledger, and the live schema all agree.

The application uses:

- a single hardcoded credential for identity (no Supabase Auth; see `src/lib/auth-config.ts`)
- Postgres tables under `public`
- Supabase Storage for portrait assets
- row-level security policies on all application tables, retained but **bypassed** by the service-role admin client (ownership is enforced in app code and in RPC `p_user_id` arguments)
- SQL RPCs for multi-step thread operations

## Core Entity Groups

### Identity and access

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | mirrors an authenticated user inside app-owned data | `id`, `email`, `is_allowed` |

### Provider configuration

| Table | Purpose | Key columns |
| --- | --- | --- |
| `ai_connections` | saved BYOK provider lanes | `provider`, `label`, `encrypted_api_key`, `base_url`, `default_model_id`, `model_cache`, `health_status` |

### User-authored content

| Table | Purpose | Key columns |
| --- | --- | --- |
| `user_personas` | durable user voice / identity presets | `name`, `identity`, `backstory`, `voice_style`, `goals`, `boundaries`, `private_notes`, `is_default` |
| `characters` | roleplay character sheets | `name`, `story`, `core_persona`, `greeting`, `appearance`, `style_rules`, `definition`, `negative_guidance`, `starters`, `example_conversations`, generation settings, portrait fields |

### Threads and transcript state

| Table | Purpose | Key columns |
| --- | --- | --- |
| `chat_threads` | top-level conversation container | `character_id`, `connection_id`, `model_id`, `persona_id`, `title`, `status`, `pinned_at` |
| `chat_branches` | alternate timelines within a thread | `name`, `parent_branch_id`, `fork_turn_id`, `head_turn_id`, `is_active`, `generation_locked`, `locked_by_turn_id` |
| `chat_turns` | user/assistant exchange records | `parent_turn_id`, `user_input_text`, `assistant_output_text`, `generation_status`, provider/model metadata, token counts, feedback |

### World state and continuity

| Table | Purpose | Key columns |
| --- | --- | --- |
| `world_snapshots` | per-turn durable world state, stored as one JSONB blob | `turn_id`, `thread_id`, `branch_id`, `based_on_turn_id`, `world_state` (JSONB), `version`, `is_full_materialization` |
| `chat_timeline_events` | notable moments surfaced in the inspector | `title`, `detail`, `importance`, `event_type`, `turn_id`, `affected_entity_ids`, `affected_relationship_ids` |
| `chat_pins` | manually pinned facts or reminders | `body`, `status`, `turn_id` |

World state is a single `DurableMemorySnapshot` JSONB blob per turn in `world_snapshots.world_state` (sub-objects: `metadata`, `entity_state`, `relational_state`, `spatial_state`, `narrative_state`). This replaced an earlier normalized model: the `world_state` column was added, all content moved into it, and the legacy `world_*` tables (`world_entities`, `world_entity_facts`, `world_relationships`, `world_locations`, `world_location_edges`, `world_entity_placements`, `world_narrative_threads`) and old scalar columns (`story_summary`, `scene_summary`, `last_turn_beat`, `narrative_timestamp`, `transition_type`) were dropped. Snapshot reads are a pure blob parse (`src/lib/domain/world-snapshot.ts`); mutations apply in memory via `src/lib/domain/world-state-reducer.ts` before one atomic `upsert_world_snapshot` RPC.

### Background work

| Table | Purpose | Key columns |
| --- | --- | --- |
| `character_portrait_tasks` | portrait generation queue | `character_id`, `prompt`, `seed`, `source_hash`, `status`, `attempts`, `available_at`, `locked_at` |

## Relationship Summary

- `profiles.id` is a standalone UUID — the FK to `auth.users` was dropped with the single-user auth switch, and the single fixed user (`FIXED_USER_ID`) is seeded directly
- each `ai_connections`, `user_personas`, and `characters` row belongs to one profile
- each `chat_thread` belongs to one profile and references one character, connection, and optional persona
- each `chat_branch` belongs to one thread
- each `chat_turn` belongs to one thread and one branch origin
- `chat_turns.parent_turn_id` forms the reachable turn chain inside a thread
- each snapshot belongs to one turn, one thread, and one branch
- pins and timeline events belong to a thread and a branch, and may also reference a turn

## Important Constraints and Indexes

Notable constraints baked into the schema:

- only one default persona per user
- only one active branch per thread
- `generation_status` is restricted to `reserved`, `streaming`, `committed`, `failed`
- task statuses are restricted to `pending`, `running`, `succeeded`, `failed`
- portrait status is restricted to `idle`, `pending`, `ready`, `failed`
- chat turn foreign keys include `(id, thread_id)` pairings to keep cross-thread references impossible

Notable indexes support:

- recent connections, personas, and characters by user
- thread library ordering by `pinned_at` and `updated_at`
- branch and turn lookup
- snapshot, timeline, and pin reads
- task claiming

## Portrait Storage

The baseline migration creates a Supabase storage bucket:

- bucket id: `character-portraits`
- public: `true`
- file size limit: 5 MB
- allowed mime types: `image/jpeg`

Stored object paths are built as:

`{userId}/{characterId}/{sourceHash}-{seed}.jpg`

## Key SQL Functions

The schema deliberately pushes several multi-step operations into SQL functions. Because the service-role client makes `auth.uid()` NULL inside Postgres, every ownership-gated RPC takes an explicit `p_user_id` and enforces ownership against it — never `auth.uid()`.

### Identity and branch management

- `set_default_persona(p_user_id uuid, target_persona_id uuid)`
  - clears other defaults for the same user and marks the chosen persona as default
- `activate_branch(p_user_id uuid, p_thread_id uuid, p_branch_id uuid)`
  - deactivates the current active branch and activates the chosen branch
- `owns_thread(target_thread_id uuid)`
  - legacy `auth.uid()`-based helper retained only for the (now bypassed) RLS policies; not called by app code

### Turn lifecycle

- `begin_turn(...)`
  - asserts thread ownership and branch lock safety
  - validates expected head turn
  - inserts a reserved turn
  - locks the branch against concurrent generation

- `commit_turn(...)`
  - writes assistant output and usage metadata
  - marks the turn committed
  - advances the branch head
  - unlocks the branch
  - bumps thread `updated_at`

- `fail_turn(...)`
  - marks the turn failed
  - clears the branch lock if that turn owned it

### Branch operations

- `create_branch_from_turn(...)`
  - creates a new branch rooted at a visible turn
  - records the parent branch and fork turn
  - may switch active branch immediately

- `rewind_branch_to_turn(...)`
  - validates reachability
  - resets the active branch head
  - deletes descendant turns
  - deletes sibling branches rooted inside the deleted subtree

### Background task helpers

- `claim_character_portrait_tasks(limit_count)`
- `cleanup_stale_generation_locks(p_stale_before interval)`

The claim functions implement `FOR UPDATE SKIP LOCKED` task claiming and increment attempts on claim.

## RLS Model

Every application table has row-level security policies, but they are **not the access gate**: all app data is read and written through the service-role admin client, which bypasses RLS. The policies are kept for defense-in-depth (in case RLS is ever re-enabled), and broadly:

- identity-owned tables use direct `user_id = auth.uid()` checks
- thread-derived tables use helper checks such as `owns_thread(thread_id)`

Because the service role bypasses RLS, these `auth.uid()` policies currently never fire — `auth.uid()` is NULL under the service-role client. Ownership is instead enforced in application code (every query scopes on `FIXED_USER_ID`) and in the RPCs (explicit `p_user_id`). Any new RPC must take the user id explicitly rather than rely on `auth.uid()`.

## Source of Truth

### `0001_baseline.sql` (single consolidated baseline)

There is exactly one migration file: `0001_baseline.sql`. It is a live-derived snapshot of the `public` schema — all tables, constraints, indexes, triggers, SQL RPCs (with explicit `p_user_id`), RLS policies, the `world_state` JSONB model, the storage bucket, and the fixed-user seed. Earlier incremental migrations (the JSONB world-state rebuild, the single-user auth switch, the `p_user_id` RPC change) were squashed into it.

The single migration file, the `supabase_migrations.schema_migrations` ledger (which records only `0001`), and the live schema are all in agreement — that is the single source of truth.

When the schema is deliberately re-baselined, the workflow is:

- regenerate `0001_baseline.sql` from the live Supabase schema (introspect via the access token, or `supabase db dump`)
- fold required non-schema config (storage bucket rows, the fixed-user seed) back into the file
- repair the remote migration ledger so it records only the baseline (`supabase migration repair --status reverted` for the squashed versions)
- smoke-test the regenerated baseline against a throwaway Postgres before committing

## Runtime Invariants That Matter During Changes

- a thread should not proceed without a persona, connection, model, and character
- only one branch can generate at a time
- branch head updates happen through the turn lifecycle functions
- the active path is the authoritative transcript path for pins, branches, rewind, and ratings
- committed turns should end with a continuity snapshot or a documented blocking state
- portrait tasks may safely retry; continuity materialization is expected inline

## Type Bindings

The generated database type bindings live at:

- `src/lib/supabase/database.types.ts`

The application then narrows and validates those shapes in:

- `src/lib/types.ts`
- `src/lib/validation.ts`
- the domain modules under `src/lib/data/`

Whenever a schema change lands, update or regenerate the corresponding TypeScript types and then check the affected data modules and tests.
