create or replace function public.set_default_persona(target_user_id uuid, target_persona_id uuid)
returns setof public.user_personas
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from target_user_id
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  update public.user_personas
  set is_default = false
  where user_id = target_user_id
    and is_default = true;

  return query
  with updated as (
    update public.user_personas
    set is_default = true
    where id = target_persona_id
      and user_id = target_user_id
    returning *
  )
  select * from updated;

  if not found then
    raise exception 'Persona not found.';
  end if;
end;
$$;

revoke all on function public.set_default_persona(uuid, uuid) from public;
grant execute on function public.set_default_persona(uuid, uuid) to authenticated;
