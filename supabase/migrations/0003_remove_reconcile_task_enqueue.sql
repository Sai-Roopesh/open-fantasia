create or replace function public.commit_turn(
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
  p_completion_tokens integer
)
returns public.chat_turns
language plpgsql
security invoker
set search_path = public
as $$
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

truncate table public.turn_reconcile_tasks;
