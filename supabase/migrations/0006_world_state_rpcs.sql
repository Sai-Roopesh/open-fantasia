-- ============================================================================
-- World State JSONB — step 2 of 3: RPCs + correctness fixes
-- ----------------------------------------------------------------------------
-- 1. upsert_world_snapshot: atomic single-row snapshot write (replaces the
--    ~30 sequential, transaction-less writes of applyMutationsToDb).
-- 2. commit_turn: now deletes the replaced turn on a rewrite/regenerate, so the
--    old committed turn (and its snapshot, via ON DELETE CASCADE) is removed
--    instead of being orphaned. Fixes the zombie-turn accumulation that left
--    ~50 dangling rows in the live DB.
-- 3. create_thread_with_branch: atomic thread + Main branch creation, replacing
--    the fragile insert-then-compensating-delete in the data layer.
--
-- NOTE: fork (create_branch_from_turn) intentionally does NOT copy world state.
-- Snapshots are keyed by turn_id and turns are shared across branches, so a
-- forked branch transparently reads its shared ancestor snapshot and only writes
-- fresh snapshots for its divergent turns. No copy needed; full isolation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Atomic world snapshot upsert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_world_snapshot(
  p_turn_id uuid,
  p_thread_id uuid,
  p_branch_id uuid,
  p_based_on_turn_id uuid,
  p_world_state jsonb,
  p_version integer,
  p_is_full_materialization boolean
) RETURNS public.world_snapshots
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  result public.world_snapshots;
begin
  insert into public.world_snapshots (
    turn_id, thread_id, branch_id, based_on_turn_id,
    world_state, version, is_full_materialization
  ) values (
    p_turn_id, p_thread_id, p_branch_id, p_based_on_turn_id,
    coalesce(p_world_state, '{}'::jsonb),
    coalesce(p_version, 1),
    coalesce(p_is_full_materialization, false)
  )
  on conflict (turn_id) do update set
    world_state = excluded.world_state,
    based_on_turn_id = excluded.based_on_turn_id,
    version = excluded.version,
    is_full_materialization = excluded.is_full_materialization,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. commit_turn — delete the replaced turn on rewrite/regenerate
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.commit_turn(uuid, uuid, text, jsonb, text, text, text, text, integer, integer, integer);

CREATE FUNCTION public.commit_turn(
  p_branch_id uuid,
  p_turn_id uuid,
  p_assistant_output_text text,
  p_assistant_output_payload jsonb,
  p_assistant_provider text,
  p_assistant_model text,
  p_assistant_connection_label text,
  p_finish_reason text,
  p_total_tokens integer,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_replace_turn_id uuid DEFAULT NULL
) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  committed_turn public.chat_turns;
begin
  select * into target_branch from public.chat_branches where id = p_branch_id;
  if not found then
    raise exception 'Branch not found or not owned by current user.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.chat_threads
    where id = target_branch.thread_id and user_id = auth.uid()
  ) then
    raise exception 'Branch not found or not owned by current user.' using errcode = 'P0001';
  end if;

  if target_branch.locked_by_turn_id is distinct from p_turn_id then
    raise exception 'This branch is not locked by the target turn.' using errcode = 'P0001';
  end if;

  update public.chat_turns
  set assistant_output_text = coalesce(p_assistant_output_text, ''),
      assistant_output_payload = coalesce(p_assistant_output_payload, '[]'::jsonb),
      assistant_provider = p_assistant_provider,
      assistant_model = p_assistant_model,
      assistant_connection_label = p_assistant_connection_label,
      finish_reason = p_finish_reason,
      total_tokens = p_total_tokens,
      prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens,
      generation_status = 'committed',
      generation_finished_at = now(),
      updated_at = now()
  where id = p_turn_id
    and thread_id = target_branch.thread_id
  returning * into committed_turn;

  if not found then
    raise exception 'Turn not found on the target branch.' using errcode = 'P0001';
  end if;

  -- Move the head to the freshly committed turn BEFORE deleting the replaced
  -- turn, so head_turn_id never transiently dangles (it is ON DELETE SET NULL).
  update public.chat_branches
  set head_turn_id = p_turn_id,
      generation_locked = false,
      locked_by_turn_id = null,
      locked_at = null,
      updated_at = now()
  where id = p_branch_id;

  -- On a rewrite/regenerate the new turn re-parents to the replaced turn's
  -- parent, so the replaced turn is now a non-head sibling. Delete it; its
  -- world_snapshot and any descendants cascade (ON DELETE CASCADE), preventing
  -- the orphaned-turn accumulation the old flow caused.
  if p_replace_turn_id is not null and p_replace_turn_id is distinct from p_turn_id then
    delete from public.chat_turns
    where id = p_replace_turn_id
      and thread_id = target_branch.thread_id;
  end if;

  update public.chat_threads set updated_at = now() where id = target_branch.thread_id;

  return committed_turn;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. create_thread_with_branch — atomic thread + Main branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_thread_with_branch(
  p_character_id uuid,
  p_connection_id uuid,
  p_model_id text,
  p_persona_id uuid,
  p_brain_connection_id uuid,
  p_brain_model_id text,
  p_max_output_tokens integer,
  p_title text
) RETURNS public.chat_threads
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  created_thread public.chat_threads;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = 'P0001';
  end if;

  insert into public.chat_threads (
    user_id, character_id, connection_id, model_id, persona_id,
    brain_connection_id, brain_model_id, max_output_tokens, title, is_title_autogenerated
  ) values (
    auth.uid(), p_character_id, p_connection_id, p_model_id, p_persona_id,
    p_brain_connection_id, p_brain_model_id, coalesce(p_max_output_tokens, 4096), p_title, true
  )
  returning * into created_thread;

  insert into public.chat_branches (thread_id, name, is_active, created_by)
  values (created_thread.id, 'Main', true, auth.uid());

  return created_thread;
end;
$$;

GRANT ALL ON FUNCTION public.upsert_world_snapshot(uuid, uuid, uuid, uuid, jsonb, integer, boolean) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.commit_turn(uuid, uuid, text, jsonb, text, text, text, text, integer, integer, integer, uuid) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.create_thread_with_branch(uuid, uuid, text, uuid, uuid, text, integer, text) TO authenticated, service_role;
