-- ============================================================================
-- HCE Rebuild Migration
-- Drops legacy chat_turn_snapshots, adds brain model fields to chat_threads,
-- adds event_type/affected_* to chat_timeline_events, and creates all world_*
-- tables for the Hybrid Continuity Engine.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop legacy table
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.chat_turn_snapshots CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Add brain model columns to chat_threads
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_threads'
      AND column_name = 'brain_connection_id'
  ) THEN
    ALTER TABLE public.chat_threads
      ADD COLUMN brain_connection_id uuid REFERENCES public.ai_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_threads'
      AND column_name = 'brain_model_id'
  ) THEN
    ALTER TABLE public.chat_threads
      ADD COLUMN brain_model_id text;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Add HCE columns to chat_timeline_events
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_timeline_events'
      AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.chat_timeline_events
      ADD COLUMN event_type text DEFAULT 'beat' NOT NULL
        CHECK (event_type IN (
          'beat','reveal','betrayal','discovery','combat',
          'scene_change','time_skip','relationship_shift',
          'emotion_shift','spatial_move'
        ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_timeline_events'
      AND column_name = 'affected_entity_ids'
  ) THEN
    ALTER TABLE public.chat_timeline_events
      ADD COLUMN affected_entity_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_timeline_events'
      AND column_name = 'affected_relationship_ids'
  ) THEN
    ALTER TABLE public.chat_timeline_events
      ADD COLUMN affected_relationship_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. World Snapshots (replaces chat_turn_snapshots)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_snapshots (
    turn_id       uuid PRIMARY KEY REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    thread_id     uuid NOT NULL    REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id     uuid NOT NULL    REFERENCES public.chat_branches(id) ON DELETE CASCADE,
    based_on_turn_id uuid          REFERENCES public.chat_turns(id) ON DELETE SET NULL,

    story_summary       text DEFAULT '' NOT NULL,
    scene_summary       text DEFAULT '' NOT NULL,
    last_turn_beat      text DEFAULT '' NOT NULL,
    narrative_timestamp text DEFAULT '' NOT NULL,
    transition_type     text DEFAULT 'continuation' NOT NULL
      CHECK (transition_type IN ('continuation','scene_transition','time_skip')),

    version                 integer DEFAULT 1 NOT NULL,
    is_full_materialization  boolean DEFAULT false NOT NULL,

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_snapshots_thread  ON public.world_snapshots(thread_id);
CREATE INDEX IF NOT EXISTS idx_world_snapshots_branch  ON public.world_snapshots(branch_id);

-- ---------------------------------------------------------------------------
-- 5. World Entities (characters, NPCs, objects, creatures, groups)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_entities (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    canonical_name  text NOT NULL,
    entity_type     text NOT NULL
      CHECK (entity_type IN ('character','npc','creature','object','group')),
    aliases         text[] DEFAULT '{}'::text[] NOT NULL,
    character_id    uuid REFERENCES public.characters(id) ON DELETE SET NULL,

    is_present          boolean DEFAULT true NOT NULL,
    primary_emotion     text DEFAULT 'neutral' NOT NULL,
    emotion_intensity   integer DEFAULT 5 NOT NULL CHECK (emotion_intensity BETWEEN 1 AND 10),
    emotion_catalyst    text DEFAULT '' NOT NULL,

    -- bi-temporal versioning
    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_entities_thread_branch
  ON public.world_entities(thread_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_world_entities_active
  ON public.world_entities(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 6. World Entity Facts (knowledge, traits, goals, secrets, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_entity_facts (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id       uuid NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    fact_type text NOT NULL
      CHECK (fact_type IN ('knowledge','trait','goal','secret','ability','possession')),
    body      text NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_entity_facts_entity
  ON public.world_entity_facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_world_entity_facts_active
  ON public.world_entity_facts(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 7. World Relationships (entity ↔ entity edges)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_relationships (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    source_entity_id uuid NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
    target_entity_id uuid NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
    relationship_type text NOT NULL
      CHECK (relationship_type IN ('social','romantic','familial','professional','adversarial','alliance','other')),
    dynamic_status   text DEFAULT '' NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_relationships_active
  ON public.world_relationships(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 8. World Locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_locations (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    canonical_name          text NOT NULL,
    description             text DEFAULT '' NOT NULL,
    environmental_modifiers text[] DEFAULT '{}'::text[] NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_locations_active
  ON public.world_locations(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 9. World Location Edges (adjacency graph)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_location_edges (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    from_location_id  uuid NOT NULL REFERENCES public.world_locations(id) ON DELETE CASCADE,
    to_location_id    uuid NOT NULL REFERENCES public.world_locations(id) ON DELETE CASCADE,
    is_bidirectional  boolean DEFAULT true NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_location_edges_active
  ON public.world_location_edges(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 10. World Entity Placements (entity → location mapping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_entity_placements (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    entity_id     uuid NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
    location_id   uuid NOT NULL REFERENCES public.world_locations(id) ON DELETE CASCADE,
    micro_position text DEFAULT '' NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_entity_placements_active
  ON public.world_entity_placements(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 11. World Narrative Threads (story arcs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_narrative_threads (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    branch_id       uuid NOT NULL REFERENCES public.chat_branches(id) ON DELETE CASCADE,

    objective      text NOT NULL,
    status         text DEFAULT 'open' NOT NULL
      CHECK (status IN ('open','blocked','resolving','resolved')),
    dependency_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,

    valid_from_turn_id      uuid NOT NULL REFERENCES public.chat_turns(id) ON DELETE CASCADE,
    invalidated_at_turn_id  uuid REFERENCES public.chat_turns(id) ON DELETE SET NULL,
    t_created               timestamp with time zone DEFAULT now() NOT NULL,
    t_expired               timestamp with time zone,

    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_narrative_threads_active
  ON public.world_narrative_threads(thread_id, branch_id)
  WHERE invalidated_at_turn_id IS NULL;

-- ---------------------------------------------------------------------------
-- 12. RLS Policies for all world_* tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.world_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_entity_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_location_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_entity_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_narrative_threads ENABLE ROW LEVEL SECURITY;

-- Read policies: user can read world state for their own threads
CREATE POLICY world_snapshots_select ON public.world_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_snapshots.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_entities_select ON public.world_entities FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_entities.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_entity_facts_select ON public.world_entity_facts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_entity_facts.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_relationships_select ON public.world_relationships FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_relationships.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_locations_select ON public.world_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_locations.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_location_edges_select ON public.world_location_edges FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_location_edges.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_entity_placements_select ON public.world_entity_placements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_entity_placements.thread_id AND t.user_id = auth.uid()));

CREATE POLICY world_narrative_threads_select ON public.world_narrative_threads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = world_narrative_threads.thread_id AND t.user_id = auth.uid()));

-- Service role can do everything (all writes happen server-side)
CREATE POLICY world_snapshots_service ON public.world_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_entities_service ON public.world_entities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_entity_facts_service ON public.world_entity_facts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_relationships_service ON public.world_relationships FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_locations_service ON public.world_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_location_edges_service ON public.world_location_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_entity_placements_service ON public.world_entity_placements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY world_narrative_threads_service ON public.world_narrative_threads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant access to authenticated and service roles
GRANT ALL ON public.world_snapshots TO authenticated, service_role;
GRANT ALL ON public.world_entities TO authenticated, service_role;
GRANT ALL ON public.world_entity_facts TO authenticated, service_role;
GRANT ALL ON public.world_relationships TO authenticated, service_role;
GRANT ALL ON public.world_locations TO authenticated, service_role;
GRANT ALL ON public.world_location_edges TO authenticated, service_role;
GRANT ALL ON public.world_entity_placements TO authenticated, service_role;
GRANT ALL ON public.world_narrative_threads TO authenticated, service_role;
