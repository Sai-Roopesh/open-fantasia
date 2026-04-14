create or replace function public.get_thread_graph_payload(
  p_user_id uuid,
  p_thread_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  owned_thread public.chat_threads;
  active_branch public.chat_branches;
begin
  select *
  into owned_thread
  from public.chat_threads threads
  where threads.id = p_thread_id
    and threads.user_id = p_user_id;

  if owned_thread.id is null or owned_thread.active_branch_id is null then
    return null;
  end if;

  select *
  into active_branch
  from public.chat_branches branches
  where branches.id = owned_thread.active_branch_id
    and branches.thread_id = p_thread_id;

  if active_branch.id is null then
    return null;
  end if;

  return (
    with recursive checkpoint_path as (
      select
        checkpoints.id,
        checkpoints.thread_id,
        checkpoints.branch_id,
        checkpoints.parent_checkpoint_id,
        checkpoints.user_message_id,
        checkpoints.assistant_message_id,
        checkpoints.choice_group_key,
        checkpoints.feedback_rating,
        checkpoints.created_by,
        checkpoints.created_at,
        0 as depth
      from public.chat_checkpoints checkpoints
      where checkpoints.id = active_branch.head_checkpoint_id

      union all

      select
        parent.id,
        parent.thread_id,
        parent.branch_id,
        parent.parent_checkpoint_id,
        parent.user_message_id,
        parent.assistant_message_id,
        parent.choice_group_key,
        parent.feedback_rating,
        parent.created_by,
        parent.created_at,
        child.depth + 1
      from public.chat_checkpoints parent
      inner join checkpoint_path child
        on child.parent_checkpoint_id = parent.id
      where parent.thread_id = p_thread_id
    ),
    ordered_checkpoints as (
      select
        id,
        thread_id,
        branch_id,
        parent_checkpoint_id,
        user_message_id,
        assistant_message_id,
        choice_group_key,
        feedback_rating,
        created_by,
        created_at,
        depth
      from checkpoint_path
      order by depth desc
    ),
    checkpoint_ids as (
      select coalesce(array_agg(checkpoints.id), array[]::uuid[]) as value
      from ordered_checkpoints checkpoints
    ),
    message_ids as (
      select coalesce(array_agg(distinct ids.message_id), array[]::text[]) as value
      from (
        select checkpoints.user_message_id as message_id
        from ordered_checkpoints checkpoints
        union
        select checkpoints.assistant_message_id as message_id
        from ordered_checkpoints checkpoints
      ) ids
    ),
    message_rows as (
      select
        messages.id,
        messages.thread_id,
        messages.role,
        messages.parts,
        messages.content_text,
        messages.metadata,
        messages.created_at
      from public.chat_messages messages
      where messages.id = any((select value from message_ids))
    ),
    snapshot_rows as (
      select
        snapshots.checkpoint_id,
        snapshots.thread_id,
        snapshots.branch_id,
        snapshots.based_on_snapshot_id,
        snapshots.scenario_state,
        snapshots.relationship_state,
        snapshots.rolling_summary,
        snapshots.user_facts,
        snapshots.open_loops,
        snapshots.resolved_loops,
        snapshots.narrative_hooks,
        snapshots.scene_goals,
        snapshots.version,
        snapshots.updated_at
      from public.chat_state_snapshots snapshots
      where snapshots.checkpoint_id = any((select value from checkpoint_ids))
    ),
    timeline_rows as (
      select
        events.id,
        events.thread_id,
        events.branch_id,
        events.checkpoint_id,
        events.source_message_id,
        events.title,
        events.detail,
        events.importance,
        events.created_at
      from public.chat_timeline_events events
      where events.thread_id = p_thread_id
        and events.branch_id = active_branch.id
      order by events.created_at desc
      limit 24
    ),
    pin_rows as (
      select
        pins.id,
        pins.thread_id,
        pins.branch_id,
        pins.source_message_id,
        pins.body,
        pins.status,
        pins.created_at,
        pins.updated_at
      from public.chat_pins pins
      where pins.thread_id = p_thread_id
        and pins.branch_id = active_branch.id
        and pins.status = 'active'
      order by pins.created_at desc
    ),
    latest_reconcile_job as (
      select
        jobs.id,
        jobs.type,
        jobs.status,
        jobs.user_id,
        jobs.thread_id,
        jobs.branch_id,
        jobs.checkpoint_id,
        jobs.payload,
        jobs.attempts,
        jobs.max_attempts,
        jobs.available_at,
        jobs.locked_at,
        jobs.last_error,
        jobs.created_at,
        jobs.updated_at
      from public.background_jobs jobs
      where jobs.type = 'reconcile_checkpoint'
        and jobs.checkpoint_id = active_branch.head_checkpoint_id
      order by jobs.created_at desc
      limit 1
    )
    select jsonb_build_object(
      'thread',
      to_jsonb(owned_thread),
      'activeBranch',
      to_jsonb(active_branch),
      'branches',
      coalesce(
        (
          select jsonb_agg(to_jsonb(branches) order by branches.created_at)
          from public.chat_branches branches
          where branches.thread_id = p_thread_id
        ),
        '[]'::jsonb
      ),
      'checkpoints',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(checkpoints) - 'depth'
            order by checkpoints.depth desc
          )
          from ordered_checkpoints checkpoints
        ),
        '[]'::jsonb
      ),
      'messages',
      coalesce(
        (
          select jsonb_agg(to_jsonb(messages))
          from message_rows messages
        ),
        '[]'::jsonb
      ),
      'snapshots',
      coalesce(
        (
          select jsonb_agg(to_jsonb(snapshots))
          from snapshot_rows snapshots
        ),
        '[]'::jsonb
      ),
      'timeline',
      coalesce(
        (
          select jsonb_agg(to_jsonb(events) order by events.created_at desc)
          from timeline_rows events
        ),
        '[]'::jsonb
      ),
      'pins',
      coalesce(
        (
          select jsonb_agg(to_jsonb(pins) order by pins.created_at desc)
          from pin_rows pins
        ),
        '[]'::jsonb
      ),
      'latestReconcileJob',
      (
        select to_jsonb(jobs)
        from latest_reconcile_job jobs
      )
    )
  );
end;
$$;
