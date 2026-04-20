alter table public.chat_turns
  drop constraint if exists chat_turns_parent_turn_fkey;

alter table public.chat_turns
  add constraint chat_turns_parent_turn_fkey
  foreign key (parent_turn_id, thread_id)
  references public.chat_turns(id, thread_id)
  on delete cascade;

alter table public.chat_branches
  drop constraint if exists chat_branches_fork_turn_fkey;

alter table public.chat_branches
  add constraint chat_branches_fork_turn_fkey
  foreign key (fork_turn_id, thread_id)
  references public.chat_turns(id, thread_id)
  on delete set null;

alter table public.chat_branches
  drop constraint if exists chat_branches_head_turn_fkey;

alter table public.chat_branches
  add constraint chat_branches_head_turn_fkey
  foreign key (head_turn_id, thread_id)
  references public.chat_turns(id, thread_id)
  on delete set null;

alter table public.chat_branches
  drop constraint if exists chat_branches_locked_turn_fkey;

alter table public.chat_branches
  add constraint chat_branches_locked_turn_fkey
  foreign key (locked_by_turn_id, thread_id)
  references public.chat_turns(id, thread_id)
  on delete set null;

alter table public.chat_timeline_events
  drop constraint if exists chat_timeline_events_turn_id_fkey;

alter table public.chat_timeline_events
  add constraint chat_timeline_events_turn_id_fkey
  foreign key (turn_id)
  references public.chat_turns(id)
  on delete cascade;

alter table public.chat_pins
  drop constraint if exists chat_pins_turn_id_fkey;

alter table public.chat_pins
  add constraint chat_pins_turn_id_fkey
  foreign key (turn_id)
  references public.chat_turns(id)
  on delete cascade;

create or replace function public.rewind_branch_to_turn(
  p_branch_id uuid,
  p_target_turn_id uuid,
  p_expected_head_turn_id uuid default null
)
returns public.chat_branches
language plpgsql
security invoker
set search_path = public
as $$
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
