-- ============================================================================
-- World State JSONB — step 3 of 3: drop the legacy normalized model
-- ----------------------------------------------------------------------------
-- DESTRUCTIVE. Apply ONLY after:
--   1. migration 0005 (world_state column) is applied
--   2. scripts/backfill-world-state-jsonb.mjs has run (world_state populated)
--   3. the Phase 3 code rewrite is deployed (nothing reads world_entities et al.
--      or the world_snapshots narrative scalar columns anymore)
--
-- Drops the 7 normalized world_* tables and the now-redundant scalar columns on
-- world_snapshots (all of which now live inside world_state JSONB). After this,
-- world_snapshots is: turn_id, thread_id, branch_id, based_on_turn_id,
-- world_state, version, is_full_materialization, created_at, updated_at.
-- ============================================================================

-- Redundant scalar columns — content is now in world_state->'narrative_state'
-- and world_state->'metadata'.
ALTER TABLE public.world_snapshots
  DROP COLUMN IF EXISTS story_summary,
  DROP COLUMN IF EXISTS scene_summary,
  DROP COLUMN IF EXISTS last_turn_beat,
  DROP COLUMN IF EXISTS narrative_timestamp,
  DROP COLUMN IF EXISTS transition_type;

-- The normalized, bi-temporally versioned world tables. Order respects FKs;
-- CASCADE covers the rest.
DROP TABLE IF EXISTS public.world_entity_placements CASCADE;
DROP TABLE IF EXISTS public.world_location_edges CASCADE;
DROP TABLE IF EXISTS public.world_narrative_threads CASCADE;
DROP TABLE IF EXISTS public.world_relationships CASCADE;
DROP TABLE IF EXISTS public.world_entity_facts CASCADE;
DROP TABLE IF EXISTS public.world_locations CASCADE;
DROP TABLE IF EXISTS public.world_entities CASCADE;

-- world_state should no longer carry a default once every row is populated;
-- new writes always provide the full snapshot.
ALTER TABLE public.world_snapshots
  ALTER COLUMN world_state DROP DEFAULT;
