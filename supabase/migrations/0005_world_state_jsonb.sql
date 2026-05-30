-- ============================================================================
-- World State → single JSONB blob (step 1 of 3: additive column)
-- ----------------------------------------------------------------------------
-- The HCE previously spread one turn's world state across 7 normalized,
-- bi-temporally versioned tables (world_entities, _facts, _relationships,
-- _locations, _location_edges, _entity_placements, _narrative_threads).
-- Applying a single turn's mutations meant ~30 sequential, unbatched writes
-- with no transaction boundary, so a crash mid-apply left world state partially
-- written, and regenerate/edit left orphaned rows keyed to replaced turns.
--
-- The redesign stores the entire DurableMemorySnapshot for a turn as one JSONB
-- value on world_snapshots. The snapshot IS the source of truth. This makes a
-- turn's continuity write a single atomic upsert, makes fork a single-row copy,
-- and lets ON DELETE CASCADE (already on world_snapshots.turn_id) garbage-collect
-- everything when a turn is rewound or replaced.
--
-- This migration is additive and safe: it only adds the column. A backfill
-- script then populates it from the normalized tables, and a later migration
-- (0007) drops the now-redundant tables and scalar columns.
-- ============================================================================

ALTER TABLE public.world_snapshots
  ADD COLUMN IF NOT EXISTS world_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.world_snapshots.world_state IS
  'Full serialized DurableMemorySnapshot for this turn (spatial_state, entity_state, relational_state, narrative_state, metadata). Source of truth for branch continuity.';
