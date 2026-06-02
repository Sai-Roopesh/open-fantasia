-- ============================================================================
-- Single-user RPC identity — finish what 0008 started.
-- ----------------------------------------------------------------------------
-- 0008 moved auth to a hardcoded credential and routes all DB access through
-- the service-role admin client. That client carries no user JWT, so inside
-- Postgres `auth.uid()` is NULL.
--
-- 0008's comment assumed every `auth.uid()` reference lived in an RLS *policy*
-- (which the service role bypasses). It does not: several RPC bodies hard-code
-- `where user_id = auth.uid()` as an ownership guard, and the service role does
-- NOT bypass logic inside a function. With `auth.uid()` NULL those guards match
-- nothing and every call raises "not found / not owned by current user".
--
-- Symptoms in production: no turn can begin or commit, no branch can be created,
-- switched, or rewound, and (because continuity snapshots only materialize after
-- a committed turn) the Continuity Inspector / HCE shows empty for any thread the
-- user tries to advance.
--
-- Fix: the DB no longer has an ambient notion of "the current user", so the
-- trusted app layer passes the caller's id explicitly as `p_user_id` and each
-- function enforces ownership against it. No `auth.uid()`, no fallback.
--
-- `owns_thread()` is intentionally left untouched: it is only referenced by RLS
-- policies, which the service role bypasses, so it is harmless dead weight rather
-- than a live code path. (`activate_branch` previously called it directly; that
-- call is inlined below against `p_user_id`.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- begin_turn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.begin_turn(uuid, uuid, text, jsonb, uuid, boolean, boolean, boolean);

CREATE FUNCTION public.begin_turn(
  p_user_id uuid,
  p_branch_id uuid,
  p_expected_head_turn_id uuid,
  p_user_input_text text,
  p_user_input_payload jsonb DEFAULT '[]'::jsonb,
  p_parent_turn_id_override uuid DEFAULT NULL::uuid,
  p_force_parent_override boolean DEFAULT false,
  p_user_input_hidden boolean DEFAULT false,
  p_starter_seed boolean DEFAULT false
) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  target_thread public.chat_threads;
  reserved_turn public.chat_turns;
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select *
  into target_branch
  from public.chat_branches
  where id = p_branch_id;

  if not found then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  select *
  into target_thread
  from public.chat_threads
  where id = target_branch.thread_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  if target_branch.generation_locked then
    raise exception 'A turn is already generating on this branch.'
      using errcode = 'P0001';
  end if;

  if target_branch.head_turn_id is distinct from p_expected_head_turn_id then
    raise exception 'Branch head changed before generation could begin.'
      using errcode = 'P0001';
  end if;

  insert into public.chat_turns (
    thread_id,
    branch_origin_id,
    parent_turn_id,
    user_input_text,
    user_input_payload,
    user_input_hidden,
    starter_seed,
    generation_status,
    reserved_by_user_id
  ) values (
    target_branch.thread_id,
    target_branch.id,
    case
      when coalesce(p_force_parent_override, false) then p_parent_turn_id_override
      else target_branch.head_turn_id
    end,
    coalesce(p_user_input_text, ''),
    coalesce(p_user_input_payload, '[]'::jsonb),
    coalesce(p_user_input_hidden, false),
    coalesce(p_starter_seed, false),
    'reserved',
    p_user_id
  )
  returning *
  into reserved_turn;

  update public.chat_branches
  set generation_locked = true,
      locked_by_turn_id = reserved_turn.id,
      locked_at = now(),
      updated_at = now()
  where id = target_branch.id;

  return reserved_turn;
end;
$$;

GRANT ALL ON FUNCTION public.begin_turn(uuid, uuid, uuid, text, jsonb, uuid, boolean, boolean, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- commit_turn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.commit_turn(uuid, uuid, text, jsonb, text, text, text, text, integer, integer, integer, uuid);

CREATE FUNCTION public.commit_turn(
  p_user_id uuid,
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
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select * into target_branch from public.chat_branches where id = p_branch_id;
  if not found then
    raise exception 'Branch not found or not owned by current user.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.chat_threads
    where id = target_branch.thread_id and user_id = p_user_id
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
  -- world_snapshot and any descendants cascade (ON DELETE CASCADE).
  if p_replace_turn_id is not null and p_replace_turn_id is distinct from p_turn_id then
    delete from public.chat_turns
    where id = p_replace_turn_id
      and thread_id = target_branch.thread_id;
  end if;

  update public.chat_threads set updated_at = now() where id = target_branch.thread_id;

  return committed_turn;
end;
$$;

GRANT ALL ON FUNCTION public.commit_turn(uuid, uuid, uuid, text, jsonb, text, text, text, text, integer, integer, integer, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- fail_turn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fail_turn(uuid, uuid, text, text);

CREATE FUNCTION public.fail_turn(
  p_user_id uuid,
  p_branch_id uuid,
  p_turn_id uuid,
  p_failure_code text,
  p_failure_message text
) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  failed_turn public.chat_turns;
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select branches.*
  into target_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_branch_id
    and threads.user_id = p_user_id;

  if not found then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  update public.chat_turns
  set generation_status = 'failed',
      generation_finished_at = now(),
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      updated_at = now()
  where id = p_turn_id
    and thread_id = target_branch.thread_id
  returning *
  into failed_turn;

  if target_branch.locked_by_turn_id = p_turn_id then
    update public.chat_branches
    set generation_locked = false,
        locked_by_turn_id = null,
        locked_at = null,
        updated_at = now()
    where id = p_branch_id;
  end if;

  return failed_turn;
end;
$$;

GRANT ALL ON FUNCTION public.fail_turn(uuid, uuid, uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_branch_from_turn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_branch_from_turn(uuid, uuid, text, boolean);

CREATE FUNCTION public.create_branch_from_turn(
  p_user_id uuid,
  p_source_branch_id uuid,
  p_source_turn_id uuid,
  p_name text,
  p_make_active boolean DEFAULT true
) RETURNS public.chat_branches
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  source_branch public.chat_branches;
  source_turn public.chat_turns;
  created_branch public.chat_branches;
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select branches.*
  into source_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_source_branch_id
    and threads.user_id = p_user_id;

  if not found then
    raise exception 'Source branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  select *
  into source_turn
  from public.chat_turns
  where id = p_source_turn_id
    and thread_id = source_branch.thread_id;

  if not found then
    raise exception 'Source turn not found on the selected thread.'
      using errcode = 'P0001';
  end if;

  if p_make_active then
    update public.chat_branches
    set is_active = false,
        updated_at = now()
    where thread_id = source_branch.thread_id
      and is_active = true;
  end if;

  insert into public.chat_branches (
    thread_id,
    name,
    parent_branch_id,
    fork_turn_id,
    head_turn_id,
    is_active,
    created_by
  ) values (
    source_branch.thread_id,
    p_name,
    source_branch.id,
    source_turn.id,
    source_turn.id,
    p_make_active,
    p_user_id
  )
  returning *
  into created_branch;

  update public.chat_threads
  set updated_at = now()
  where id = source_branch.thread_id;

  return created_branch;
end;
$$;

GRANT ALL ON FUNCTION public.create_branch_from_turn(uuid, uuid, uuid, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- rewind_branch_to_turn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rewind_branch_to_turn(uuid, uuid, uuid);

CREATE FUNCTION public.rewind_branch_to_turn(
  p_user_id uuid,
  p_branch_id uuid,
  p_target_turn_id uuid,
  p_expected_head_turn_id uuid DEFAULT NULL::uuid
) RETURNS public.chat_branches
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  resolved_branch public.chat_branches;
  target_is_reachable boolean;
  prune_root_turn_id uuid;
  doomed_branch_ids uuid[];
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select branches.*
  into target_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_branch_id
    and threads.user_id = p_user_id;

  if not found then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  if target_branch.generation_locked then
    raise exception 'Cannot rewind while this branch is locked for generation.'
      using errcode = 'P0001';
  end if;

  if p_expected_head_turn_id is not null
     and target_branch.head_turn_id is distinct from p_expected_head_turn_id then
    raise exception 'Branch head changed before rewind could complete.'
      using errcode = 'P0001';
  end if;

  with recursive reachable as (
    select id, parent_turn_id, 1 as depth
    from public.chat_turns
    where id = target_branch.head_turn_id
      and thread_id = target_branch.thread_id
    union all
    select parent.id, parent.parent_turn_id, reachable.depth + 1
    from public.chat_turns parent
    join reachable on reachable.parent_turn_id = parent.id
    where parent.thread_id = target_branch.thread_id
      and reachable.depth < 5000
  )
  select exists (
    select 1
    from reachable
    where id = p_target_turn_id
  )
  into target_is_reachable;

  if not target_is_reachable then
    raise exception 'Target turn is not reachable from the current branch head.'
      using errcode = 'P0001';
  end if;

  with recursive active_path as (
    select id, parent_turn_id, 0 as depth_from_head
    from public.chat_turns
    where id = target_branch.head_turn_id
      and thread_id = target_branch.thread_id
    union all
    select parent.id, parent.parent_turn_id, active_path.depth_from_head + 1
    from public.chat_turns parent
    join active_path on active_path.parent_turn_id = parent.id
    where parent.thread_id = target_branch.thread_id
      and active_path.depth_from_head < 5000
  ),
  path_with_children as (
    select
      id,
      lead(id) over (order by depth_from_head desc) as child_on_active_path
    from active_path
  )
  select child_on_active_path
  into prune_root_turn_id
  from path_with_children
  where id = p_target_turn_id;

  if prune_root_turn_id is not null then
    with recursive doomed_turns as (
      select id
      from public.chat_turns
      where id = prune_root_turn_id
        and thread_id = target_branch.thread_id
      union all
      select child.id
      from public.chat_turns child
      join doomed_turns on child.parent_turn_id = doomed_turns.id
      where child.thread_id = target_branch.thread_id
    )
    select coalesce(array_agg(branches.id), '{}'::uuid[])
    into doomed_branch_ids
    from public.chat_branches branches
    where branches.thread_id = target_branch.thread_id
      and branches.id <> p_branch_id
      and (
        branches.head_turn_id in (select id from doomed_turns)
        or branches.fork_turn_id in (select id from doomed_turns)
      );
  else
    doomed_branch_ids := '{}'::uuid[];
  end if;

  update public.chat_branches
  set head_turn_id = p_target_turn_id,
      updated_at = now()
  where id = p_branch_id
  returning *
  into resolved_branch;

  if prune_root_turn_id is not null then
    delete from public.chat_turns
    where id = prune_root_turn_id
      and thread_id = target_branch.thread_id;

    if coalesce(array_length(doomed_branch_ids, 1), 0) > 0 then
      delete from public.chat_branches
      where thread_id = target_branch.thread_id
        and id = any(doomed_branch_ids);
    end if;
  end if;

  update public.chat_threads
  set updated_at = now()
  where id = target_branch.thread_id;

  select *
  into resolved_branch
  from public.chat_branches
  where id = p_branch_id;

  return resolved_branch;
end;
$$;

GRANT ALL ON FUNCTION public.rewind_branch_to_turn(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- activate_branch — inline the ownership check (no owns_thread/auth.uid())
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_branch(uuid, uuid);

CREATE FUNCTION public.activate_branch(
  p_user_id uuid,
  p_thread_id uuid,
  p_branch_id uuid
) RETURNS public.chat_branches
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.chat_threads
    where id = p_thread_id and user_id = p_user_id
  ) then
    raise exception 'Thread not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  select *
  into target_branch
  from public.chat_branches
  where id = p_branch_id
    and thread_id = p_thread_id;

  if not found then
    raise exception 'Branch not found on the target thread.'
      using errcode = 'P0001';
  end if;

  update public.chat_branches
  set is_active = false,
      updated_at = now()
  where thread_id = p_thread_id
    and is_active = true;

  update public.chat_branches
  set is_active = true,
      updated_at = now()
  where id = p_branch_id
    and thread_id = p_thread_id
  returning *
  into target_branch;

  return target_branch;
end;
$$;

GRANT ALL ON FUNCTION public.activate_branch(uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_default_persona
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_default_persona(uuid);

CREATE FUNCTION public.set_default_persona(
  p_user_id uuid,
  target_persona_id uuid
) RETURNS public.user_personas
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  selected_persona public.user_personas;
begin
  if p_user_id is null then
    raise exception 'Missing user identity.' using errcode = 'P0001';
  end if;

  select *
  into selected_persona
  from public.user_personas
  where id = target_persona_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Persona not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  update public.user_personas
  set is_default = (id = target_persona_id),
      updated_at = now()
  where user_id = p_user_id;

  select *
  into selected_persona
  from public.user_personas
  where id = target_persona_id;

  return selected_persona;
end;
$$;

GRANT ALL ON FUNCTION public.set_default_persona(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_thread_with_branch
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_thread_with_branch(uuid, uuid, text, uuid, uuid, text, integer, text);

CREATE FUNCTION public.create_thread_with_branch(
  p_user_id uuid,
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
  if p_user_id is null then
    raise exception 'Not authenticated.' using errcode = 'P0001';
  end if;

  insert into public.chat_threads (
    user_id, character_id, connection_id, model_id, persona_id,
    brain_connection_id, brain_model_id, max_output_tokens, title, is_title_autogenerated
  ) values (
    p_user_id, p_character_id, p_connection_id, p_model_id, p_persona_id,
    p_brain_connection_id, p_brain_model_id, coalesce(p_max_output_tokens, 4096), p_title, true
  )
  returning * into created_thread;

  insert into public.chat_branches (thread_id, name, is_active, created_by)
  values (created_thread.id, 'Main', true, p_user_id);

  return created_thread;
end;
$$;

GRANT ALL ON FUNCTION public.create_thread_with_branch(uuid, uuid, uuid, text, uuid, uuid, text, integer, text) TO authenticated, service_role;
