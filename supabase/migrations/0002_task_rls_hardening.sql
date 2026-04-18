grant usage on schema public to authenticated;

grant select, insert, update
on table public.turn_reconcile_tasks
to authenticated;

grant select, insert, update
on table public.character_portrait_tasks
to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'turn_reconcile_tasks'
      and policyname = 'reconcile_tasks_insert_own_thread'
  ) then
    create policy "reconcile_tasks_insert_own_thread"
    on public.turn_reconcile_tasks
    for insert
    with check (public.owns_thread(thread_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'turn_reconcile_tasks'
      and policyname = 'reconcile_tasks_update_own_thread'
  ) then
    create policy "reconcile_tasks_update_own_thread"
    on public.turn_reconcile_tasks
    for update
    using (public.owns_thread(thread_id))
    with check (public.owns_thread(thread_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'character_portrait_tasks'
      and policyname = 'portrait_tasks_insert_own_user'
  ) then
    create policy "portrait_tasks_insert_own_user"
    on public.character_portrait_tasks
    for insert
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'character_portrait_tasks'
      and policyname = 'portrait_tasks_update_own_user'
  ) then
    create policy "portrait_tasks_update_own_user"
    on public.character_portrait_tasks
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end
$$;
