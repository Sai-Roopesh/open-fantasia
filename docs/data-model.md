# Data Model

This document explains the current persisted model for Open-Fantasia, including tables, relationships, SQL functions, and migration notes that matter during feature work.

## Schema Overview

The primary schema lives in `supabase/migrations/0001_baseline.sql`, with follow-up migrations refining task access, continuity behavior, and rewind semantics.

The application uses:

- Supabase Auth for identity
- Postgres tables under `public`
- Supabase Storage for portrait assets
- row-level security on all application tables
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

### Continuity and inspector state

| Table | Purpose | Key columns |
| --- | --- | --- |
| `chat_turn_snapshots` | branch continuity state keyed by turn | `story_summary`, `scene_summary`, `last_turn_beat`, `relationship_state`, `user_facts`, `active_threads`, `resolved_threads`, `next_turn_pressure`, `scene_goals`, `based_on_turn_id` |
| `chat_timeline_events` | notable moments surfaced in the inspector | `title`, `detail`, `importance`, `turn_id` |
| `chat_pins` | manually pinned facts or reminders | `body`, `status`, `turn_id` |

### Background work

| Table | Purpose | Key columns |
| --- | --- | --- |
| `character_portrait_tasks` | portrait generation queue | `character_id`, `prompt`, `seed`, `source_hash`, `status`, `attempts`, `available_at`, `locked_at` |

## Relationship Summary

- `profiles.id` references `auth.users(id)`
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

The schema deliberately pushes several multi-step operations into SQL functions.

### Identity and branch management

- `set_default_persona(target_persona_id uuid)`
  - clears other defaults for the same user and marks the chosen persona as default
- `activate_branch(p_thread_id uuid, p_branch_id uuid)`
  - deactivates the current active branch and activates the chosen branch
- `owns_thread(target_thread_id uuid)`
  - security helper used by policies and task checks

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

Every application table has row-level security enabled.

Broadly:

- identity-owned tables use direct `user_id = auth.uid()` checks
- thread-derived tables use helper checks such as `owns_thread(thread_id)`
- task tables are scoped so authenticated users can only insert or update work tied to their own thread or user

Future schema changes should preserve the same ownership boundaries unless a multi-user feature is being intentionally introduced.

## Migration History

### `0001_baseline.sql`

Introduced:

- all tables
- storage bucket
- indexes
- triggers
- all initial SQL RPCs
- RLS policies

### `0002_task_rls_hardening.sql`

Adjusted grants and insert/update policies for:

- `character_portrait_tasks`

### `0003_remove_reconcile_task_enqueue.sql`

Changed the continuity model:

- normal generation now materializes snapshots inline
- reconcile task enqueueing was removed from the turn commit path
- existing reconcile tasks were truncated

### `0004_rewind_prunes_descendants.sql`

Strengthened rewind semantics so rewinding a branch now prunes descendant turns and related branches rooted in the discarded subtree.

### `0005_hybrid_memory_redesign.sql`

Reworked continuity persistence around hybrid memory:

- cleared existing `chat_turn_snapshots`
- renamed the old summary/loop columns into the new durable-memory names
- added `last_turn_beat`
- shifted runtime semantics toward durable branch memory plus a short recent-scene window

### `0006_remove_turn_reconcile_tasks.sql`

Removed the old queued continuity pipeline entirely:

- dropped `turn_reconcile_tasks`
- dropped `claim_turn_reconcile_tasks(...)`
- left portrait draining as the only background task path

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
