--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    name text NOT NULL,
    parent_branch_id uuid,
    fork_turn_id uuid,
    head_turn_id uuid,
    is_active boolean DEFAULT false NOT NULL,
    generation_locked boolean DEFAULT false NOT NULL,
    locked_by_turn_id uuid,
    locked_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activate_branch(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_branch(p_thread_id uuid, p_branch_id uuid) RETURNS public.chat_branches
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
begin
  if not public.owns_thread(p_thread_id) then
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


--
-- Name: chat_turns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    branch_origin_id uuid NOT NULL,
    parent_turn_id uuid,
    user_input_text text DEFAULT ''::text NOT NULL,
    user_input_payload jsonb DEFAULT '[]'::jsonb NOT NULL,
    user_input_hidden boolean DEFAULT false NOT NULL,
    starter_seed boolean DEFAULT false NOT NULL,
    assistant_output_text text,
    assistant_output_payload jsonb,
    generation_status text DEFAULT 'reserved'::text NOT NULL,
    reserved_by_user_id uuid NOT NULL,
    assistant_provider text,
    assistant_model text,
    assistant_connection_label text,
    finish_reason text,
    total_tokens integer,
    prompt_tokens integer,
    completion_tokens integer,
    feedback_rating integer,
    generation_started_at timestamp with time zone DEFAULT now() NOT NULL,
    generation_finished_at timestamp with time zone,
    failure_code text,
    failure_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_turns_assistant_output_payload_check CHECK (((assistant_output_payload IS NULL) OR (jsonb_typeof(assistant_output_payload) = 'array'::text))),
    CONSTRAINT chat_turns_feedback_rating_check CHECK (((feedback_rating >= 1) AND (feedback_rating <= 4))),
    CONSTRAINT chat_turns_generation_status_check CHECK ((generation_status = ANY (ARRAY['reserved'::text, 'streaming'::text, 'committed'::text, 'failed'::text]))),
    CONSTRAINT chat_turns_user_input_payload_check CHECK ((jsonb_typeof(user_input_payload) = 'array'::text))
);


--
-- Name: begin_turn(uuid, uuid, text, jsonb, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_turn(p_branch_id uuid, p_expected_head_turn_id uuid, p_user_input_text text, p_user_input_payload jsonb DEFAULT '[]'::jsonb, p_parent_turn_id_override uuid DEFAULT NULL::uuid, p_force_parent_override boolean DEFAULT false, p_user_input_hidden boolean DEFAULT false, p_starter_seed boolean DEFAULT false) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  target_thread public.chat_threads;
  reserved_turn public.chat_turns;
begin
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
    and user_id = auth.uid();

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
    auth.uid()
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


--
-- Name: character_portrait_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_portrait_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prompt text NOT NULL,
    seed integer NOT NULL,
    source_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 8 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT character_portrait_tasks_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT character_portrait_tasks_max_attempts_check CHECK ((max_attempts > 0)),
    CONSTRAINT character_portrait_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: claim_character_portrait_tasks(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_character_portrait_tasks(limit_count integer DEFAULT 2) RETURNS SETOF public.character_portrait_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return query
  with selected as (
    select tasks.id
    from public.character_portrait_tasks tasks
    where tasks.status = 'pending'
      and tasks.available_at <= now()
      and (tasks.locked_at is null or tasks.locked_at < now() - interval '10 minutes')
    order by tasks.available_at asc, tasks.created_at asc
    limit limit_count
    for update skip locked
  ),
  updated as (
    update public.character_portrait_tasks tasks
    set status = 'running',
        attempts = tasks.attempts + 1,
        locked_at = now(),
        updated_at = now()
    where tasks.id in (select id from selected)
    returning tasks.*
  )
  select * from updated;
end;
$$;


--
-- Name: cleanup_stale_generation_locks(interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_stale_generation_locks(p_stale_before interval DEFAULT '00:05:00'::interval) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cleaned_count integer := 0;
begin
  with stale as (
    select id, thread_id, locked_by_turn_id
    from public.chat_branches
    where generation_locked = true
      and locked_at is not null
      and locked_at < now() - p_stale_before
      and locked_by_turn_id is not null
  ),
  failed_turns as (
    update public.chat_turns turns
    set generation_status = 'failed',
        generation_finished_at = now(),
        failure_code = coalesce(turns.failure_code, 'timeout'),
        failure_message = coalesce(turns.failure_message, 'Generation lock expired before completion.'),
        updated_at = now()
    where turns.id in (select locked_by_turn_id from stale)
      and turns.generation_status in ('reserved', 'streaming')
    returning turns.id
  )
  update public.chat_branches branches
  set generation_locked = false,
      locked_by_turn_id = null,
      locked_at = null,
      updated_at = now()
  where branches.id in (select id from stale);

  get diagnostics cleaned_count = row_count;
  return cleaned_count;
end;
$$;


--
-- Name: commit_turn(uuid, uuid, text, jsonb, text, text, text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_turn(p_branch_id uuid, p_turn_id uuid, p_assistant_output_text text, p_assistant_output_payload jsonb, p_assistant_provider text, p_assistant_model text, p_assistant_connection_label text, p_finish_reason text, p_total_tokens integer, p_prompt_tokens integer, p_completion_tokens integer) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  committed_turn public.chat_turns;
begin
  select *
  into target_branch
  from public.chat_branches
  where id = p_branch_id;

  if not found then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.chat_threads
    where id = target_branch.thread_id
      and user_id = auth.uid()
  ) then
    raise exception 'Branch not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  if target_branch.locked_by_turn_id is distinct from p_turn_id then
    raise exception 'This branch is not locked by the target turn.'
      using errcode = 'P0001';
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
  returning *
  into committed_turn;

  if not found then
    raise exception 'Turn not found on the target branch.'
      using errcode = 'P0001';
  end if;

  update public.chat_branches
  set head_turn_id = p_turn_id,
      generation_locked = false,
      locked_by_turn_id = null,
      locked_at = null,
      updated_at = now()
  where id = p_branch_id;

  update public.chat_threads
  set updated_at = now()
  where id = target_branch.thread_id;

  return committed_turn;
end;
$$;


--
-- Name: create_branch_from_turn(uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_branch_from_turn(p_source_branch_id uuid, p_source_turn_id uuid, p_name text, p_make_active boolean DEFAULT true) RETURNS public.chat_branches
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  source_branch public.chat_branches;
  source_turn public.chat_turns;
  created_branch public.chat_branches;
begin
  select branches.*
  into source_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_source_branch_id
    and threads.user_id = auth.uid();

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
    auth.uid()
  )
  returning *
  into created_branch;

  update public.chat_threads
  set updated_at = now()
  where id = source_branch.thread_id;

  return created_branch;
end;
$$;


--
-- Name: fail_turn(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_turn(p_branch_id uuid, p_turn_id uuid, p_failure_code text, p_failure_message text) RETURNS public.chat_turns
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  target_branch public.chat_branches;
  failed_turn public.chat_turns;
begin
  select branches.*
  into target_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_branch_id
    and threads.user_id = auth.uid();

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


--
-- Name: owns_thread(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_thread(target_thread_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.chat_threads
    where id = target_thread_id
      and user_id = auth.uid()
  );
$$;


--
-- Name: rewind_branch_to_turn(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rewind_branch_to_turn(p_branch_id uuid, p_target_turn_id uuid, p_expected_head_turn_id uuid DEFAULT NULL::uuid) RETURNS public.chat_branches
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
  select branches.*
  into target_branch
  from public.chat_branches branches
  join public.chat_threads threads on threads.id = branches.thread_id
  where branches.id = p_branch_id
    and threads.user_id = auth.uid();

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


--
-- Name: user_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_personas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    identity text DEFAULT ''::text NOT NULL,
    backstory text DEFAULT ''::text NOT NULL,
    voice_style text DEFAULT ''::text NOT NULL,
    goals text DEFAULT ''::text NOT NULL,
    boundaries text DEFAULT ''::text NOT NULL,
    private_notes text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: set_default_persona(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_default_persona(target_persona_id uuid) RETURNS public.user_personas
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  selected_persona public.user_personas;
begin
  select *
  into selected_persona
  from public.user_personas
  where id = target_persona_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Persona not found or not owned by current user.'
      using errcode = 'P0001';
  end if;

  update public.user_personas
  set is_default = (id = target_persona_id),
      updated_at = now()
  where user_id = auth.uid();

  select *
  into selected_persona
  from public.user_personas
  where id = target_persona_id;

  return selected_persona;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: ai_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    base_url text,
    encrypted_api_key text,
    enabled boolean DEFAULT true NOT NULL,
    default_model_id text,
    model_cache jsonb DEFAULT '[]'::jsonb NOT NULL,
    health_status text DEFAULT 'untested'::text NOT NULL,
    health_message text DEFAULT ''::text NOT NULL,
    last_checked_at timestamp with time zone,
    last_model_refresh_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_connections_health_status_check CHECK ((health_status = ANY (ARRAY['untested'::text, 'healthy'::text, 'auth_failed'::text, 'rate_limited'::text, 'bad_base_url'::text, 'bad_config'::text, 'needs_attention'::text, 'error'::text]))),
    CONSTRAINT ai_connections_model_cache_check CHECK ((jsonb_typeof(model_cache) = 'array'::text)),
    CONSTRAINT ai_connections_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'groq'::text, 'mistral'::text, 'openrouter'::text, 'ollama'::text])))
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    story text DEFAULT ''::text NOT NULL,
    core_persona text DEFAULT ''::text NOT NULL,
    greeting text DEFAULT ''::text NOT NULL,
    appearance text DEFAULT ''::text NOT NULL,
    style_rules text DEFAULT ''::text NOT NULL,
    definition text DEFAULT ''::text NOT NULL,
    negative_guidance text DEFAULT ''::text NOT NULL,
    starters jsonb DEFAULT '[]'::jsonb NOT NULL,
    example_conversations jsonb DEFAULT '[]'::jsonb NOT NULL,
    portrait_status text DEFAULT 'idle'::text NOT NULL,
    portrait_path text DEFAULT ''::text NOT NULL,
    portrait_prompt text DEFAULT ''::text NOT NULL,
    portrait_seed integer,
    portrait_source_hash text DEFAULT ''::text NOT NULL,
    portrait_last_error text DEFAULT ''::text NOT NULL,
    portrait_generated_at timestamp with time zone,
    temperature numeric(3,2) DEFAULT 0.92 NOT NULL,
    top_p numeric(3,2) DEFAULT 0.94 NOT NULL,
    max_output_tokens integer DEFAULT 750 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT characters_example_conversations_check CHECK ((jsonb_typeof(example_conversations) = 'array'::text)),
    CONSTRAINT characters_max_output_tokens_check CHECK (((max_output_tokens > 0) AND (max_output_tokens <= 4096))),
    CONSTRAINT characters_portrait_status_check CHECK ((portrait_status = ANY (ARRAY['idle'::text, 'pending'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT characters_starters_check CHECK ((jsonb_typeof(starters) = 'array'::text)),
    CONSTRAINT characters_temperature_check CHECK (((temperature >= (0)::numeric) AND (temperature <= (2)::numeric))),
    CONSTRAINT characters_top_p_check CHECK (((top_p > (0)::numeric) AND (top_p <= (1)::numeric)))
);


--
-- Name: chat_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    turn_id uuid,
    body text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_pins_status_check CHECK ((status = ANY (ARRAY['active'::text, 'resolved'::text])))
);


--
-- Name: chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    character_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    model_id text NOT NULL,
    persona_id uuid,
    title text DEFAULT 'New roleplay thread'::text NOT NULL,
    is_title_autogenerated boolean DEFAULT true NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    archived_at timestamp with time zone,
    pinned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_threads_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: chat_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    turn_id uuid,
    title text NOT NULL,
    detail text NOT NULL,
    importance integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_timeline_events_importance_check CHECK (((importance >= 1) AND (importance <= 5)))
);


--
-- Name: chat_turn_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_turn_snapshots (
    turn_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    based_on_turn_id uuid,
    scene_summary text DEFAULT ''::text NOT NULL,
    relationship_state text DEFAULT ''::text NOT NULL,
    story_summary text DEFAULT ''::text NOT NULL,
    user_facts jsonb DEFAULT '[]'::jsonb NOT NULL,
    active_threads jsonb DEFAULT '[]'::jsonb NOT NULL,
    resolved_threads jsonb DEFAULT '[]'::jsonb NOT NULL,
    next_turn_pressure jsonb DEFAULT '[]'::jsonb NOT NULL,
    scene_goals jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_turn_beat text DEFAULT ''::text NOT NULL,
    CONSTRAINT chat_turn_snapshots_active_threads_check CHECK ((jsonb_typeof(active_threads) = 'array'::text)),
    CONSTRAINT chat_turn_snapshots_next_turn_pressure_check CHECK ((jsonb_typeof(next_turn_pressure) = 'array'::text)),
    CONSTRAINT chat_turn_snapshots_resolved_threads_check CHECK ((jsonb_typeof(resolved_threads) = 'array'::text)),
    CONSTRAINT chat_turn_snapshots_scene_goals_check CHECK ((jsonb_typeof(scene_goals) = 'array'::text)),
    CONSTRAINT chat_turn_snapshots_user_facts_check CHECK ((jsonb_typeof(user_facts) = 'array'::text)),
    CONSTRAINT chat_turn_snapshots_version_check CHECK ((version > 0))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    is_allowed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_connections ai_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_connections
    ADD CONSTRAINT ai_connections_pkey PRIMARY KEY (id);


--
-- Name: character_portrait_tasks character_portrait_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_portrait_tasks
    ADD CONSTRAINT character_portrait_tasks_pkey PRIMARY KEY (id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: chat_branches chat_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_pkey PRIMARY KEY (id);


--
-- Name: chat_pins chat_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_pins
    ADD CONSTRAINT chat_pins_pkey PRIMARY KEY (id);


--
-- Name: chat_threads chat_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (id);


--
-- Name: chat_timeline_events chat_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_timeline_events
    ADD CONSTRAINT chat_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: chat_turn_snapshots chat_turn_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turn_snapshots
    ADD CONSTRAINT chat_turn_snapshots_pkey PRIMARY KEY (turn_id);


--
-- Name: chat_turns chat_turns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turns
    ADD CONSTRAINT chat_turns_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_personas user_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_personas
    ADD CONSTRAINT user_personas_pkey PRIMARY KEY (id);


--
-- Name: ai_connections_user_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_connections_user_updated_idx ON public.ai_connections USING btree (user_id, updated_at DESC);


--
-- Name: character_portrait_tasks_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_portrait_tasks_claim_idx ON public.character_portrait_tasks USING btree (status, available_at, created_at);


--
-- Name: characters_user_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characters_user_updated_idx ON public.characters USING btree (user_id, updated_at DESC);


--
-- Name: chat_branches_id_thread_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_branches_id_thread_key ON public.chat_branches USING btree (id, thread_id);


--
-- Name: chat_branches_one_active_per_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_branches_one_active_per_thread ON public.chat_branches USING btree (thread_id) WHERE (is_active = true);


--
-- Name: chat_branches_thread_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_branches_thread_updated_idx ON public.chat_branches USING btree (thread_id, updated_at DESC);


--
-- Name: chat_pins_branch_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_pins_branch_created_idx ON public.chat_pins USING btree (branch_id, status, created_at DESC);


--
-- Name: chat_threads_user_status_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_threads_user_status_updated_idx ON public.chat_threads USING btree (user_id, status, pinned_at DESC NULLS LAST, updated_at DESC);


--
-- Name: chat_timeline_events_branch_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_timeline_events_branch_created_idx ON public.chat_timeline_events USING btree (branch_id, created_at DESC);


--
-- Name: chat_turn_snapshots_branch_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_turn_snapshots_branch_updated_idx ON public.chat_turn_snapshots USING btree (branch_id, updated_at DESC);


--
-- Name: chat_turns_id_thread_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_turns_id_thread_key ON public.chat_turns USING btree (id, thread_id);


--
-- Name: chat_turns_parent_turn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_turns_parent_turn_idx ON public.chat_turns USING btree (parent_turn_id);


--
-- Name: chat_turns_thread_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_turns_thread_created_idx ON public.chat_turns USING btree (thread_id, created_at DESC);


--
-- Name: user_personas_one_default_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_personas_one_default_per_user ON public.user_personas USING btree (user_id) WHERE (is_default = true);


--
-- Name: user_personas_user_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_personas_user_updated_idx ON public.user_personas USING btree (user_id, updated_at DESC);


--
-- Name: ai_connections set_ai_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_connections_updated_at BEFORE UPDATE ON public.ai_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: character_portrait_tasks set_character_portrait_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_character_portrait_tasks_updated_at BEFORE UPDATE ON public.character_portrait_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: characters set_characters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_characters_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chat_branches set_chat_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_chat_branches_updated_at BEFORE UPDATE ON public.chat_branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chat_pins set_chat_pins_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_chat_pins_updated_at BEFORE UPDATE ON public.chat_pins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chat_threads set_chat_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chat_turns set_chat_turns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_chat_turns_updated_at BEFORE UPDATE ON public.chat_turns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_personas set_user_personas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_personas_updated_at BEFORE UPDATE ON public.user_personas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_connections ai_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_connections
    ADD CONSTRAINT ai_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: character_portrait_tasks character_portrait_tasks_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_portrait_tasks
    ADD CONSTRAINT character_portrait_tasks_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_portrait_tasks character_portrait_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_portrait_tasks
    ADD CONSTRAINT character_portrait_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: characters characters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_branches chat_branches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_branches chat_branches_fork_turn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_fork_turn_fkey FOREIGN KEY (fork_turn_id, thread_id) REFERENCES public.chat_turns(id, thread_id) ON DELETE SET NULL;


--
-- Name: chat_branches chat_branches_head_turn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_head_turn_fkey FOREIGN KEY (head_turn_id, thread_id) REFERENCES public.chat_turns(id, thread_id) ON DELETE SET NULL;


--
-- Name: chat_branches chat_branches_locked_turn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_locked_turn_fkey FOREIGN KEY (locked_by_turn_id, thread_id) REFERENCES public.chat_turns(id, thread_id) ON DELETE SET NULL;


--
-- Name: chat_branches chat_branches_parent_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_parent_branch_id_fkey FOREIGN KEY (parent_branch_id) REFERENCES public.chat_branches(id) ON DELETE SET NULL;


--
-- Name: chat_branches chat_branches_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_branches
    ADD CONSTRAINT chat_branches_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_pins chat_pins_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_pins
    ADD CONSTRAINT chat_pins_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.chat_branches(id) ON DELETE CASCADE;


--
-- Name: chat_pins chat_pins_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_pins
    ADD CONSTRAINT chat_pins_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_pins chat_pins_turn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_pins
    ADD CONSTRAINT chat_pins_turn_id_fkey FOREIGN KEY (turn_id) REFERENCES public.chat_turns(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.ai_connections(id) ON DELETE RESTRICT;


--
-- Name: chat_threads chat_threads_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.user_personas(id) ON DELETE SET NULL;


--
-- Name: chat_threads chat_threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_timeline_events chat_timeline_events_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_timeline_events
    ADD CONSTRAINT chat_timeline_events_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.chat_branches(id) ON DELETE CASCADE;


--
-- Name: chat_timeline_events chat_timeline_events_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_timeline_events
    ADD CONSTRAINT chat_timeline_events_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_timeline_events chat_timeline_events_turn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_timeline_events
    ADD CONSTRAINT chat_timeline_events_turn_id_fkey FOREIGN KEY (turn_id) REFERENCES public.chat_turns(id) ON DELETE CASCADE;


--
-- Name: chat_turn_snapshots chat_turn_snapshots_based_on_turn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turn_snapshots
    ADD CONSTRAINT chat_turn_snapshots_based_on_turn_id_fkey FOREIGN KEY (based_on_turn_id) REFERENCES public.chat_turns(id) ON DELETE SET NULL;


--
-- Name: chat_turn_snapshots chat_turn_snapshots_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turn_snapshots
    ADD CONSTRAINT chat_turn_snapshots_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.chat_branches(id) ON DELETE CASCADE;


--
-- Name: chat_turn_snapshots chat_turn_snapshots_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turn_snapshots
    ADD CONSTRAINT chat_turn_snapshots_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_turn_snapshots chat_turn_snapshots_turn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turn_snapshots
    ADD CONSTRAINT chat_turn_snapshots_turn_id_fkey FOREIGN KEY (turn_id) REFERENCES public.chat_turns(id) ON DELETE CASCADE;


--
-- Name: chat_turns chat_turns_branch_origin_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turns
    ADD CONSTRAINT chat_turns_branch_origin_fkey FOREIGN KEY (branch_origin_id, thread_id) REFERENCES public.chat_branches(id, thread_id) ON DELETE RESTRICT;


--
-- Name: chat_turns chat_turns_parent_turn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turns
    ADD CONSTRAINT chat_turns_parent_turn_fkey FOREIGN KEY (parent_turn_id, thread_id) REFERENCES public.chat_turns(id, thread_id) ON DELETE CASCADE;


--
-- Name: chat_turns chat_turns_reserved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turns
    ADD CONSTRAINT chat_turns_reserved_by_user_id_fkey FOREIGN KEY (reserved_by_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_turns chat_turns_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_turns
    ADD CONSTRAINT chat_turns_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_personas user_personas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_personas
    ADD CONSTRAINT user_personas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ai_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_branches branches_own_thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_own_thread ON public.chat_branches USING (public.owns_thread(thread_id)) WITH CHECK (public.owns_thread(thread_id));


--
-- Name: character_portrait_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_portrait_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: characters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

--
-- Name: characters characters_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY characters_own ON public.characters USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_branches ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_pins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_pins ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_timeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_timeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_turn_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_turn_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_turns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_turns ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_connections connections_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_own ON public.ai_connections USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_personas personas_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personas_own ON public.user_personas USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_pins pins_own_thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pins_own_thread ON public.chat_pins USING (public.owns_thread(thread_id)) WITH CHECK (public.owns_thread(thread_id));


--
-- Name: character_portrait_tasks portrait_tasks_insert_own_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portrait_tasks_insert_own_user ON public.character_portrait_tasks FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: character_portrait_tasks portrait_tasks_own_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portrait_tasks_own_user ON public.character_portrait_tasks FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: character_portrait_tasks portrait_tasks_update_own_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portrait_tasks_update_own_user ON public.character_portrait_tasks FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: chat_turn_snapshots snapshots_own_thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY snapshots_own_thread ON public.chat_turn_snapshots USING (public.owns_thread(thread_id)) WITH CHECK (public.owns_thread(thread_id));


--
-- Name: chat_threads threads_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY threads_own ON public.chat_threads USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_timeline_events timeline_own_thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY timeline_own_thread ON public.chat_timeline_events USING (public.owns_thread(thread_id)) WITH CHECK (public.owns_thread(thread_id));


--
-- Name: chat_turns turns_own_thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY turns_own_thread ON public.chat_turns USING (public.owns_thread(thread_id)) WITH CHECK (public.owns_thread(thread_id));


--
-- Name: user_personas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_personas ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


-- Live-derived storage bucket baseline
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'character-portraits',
    'character-portraits',
    true,
    5242880,
    ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
