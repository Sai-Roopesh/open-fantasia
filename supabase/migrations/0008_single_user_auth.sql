-- Single-user auth: decouple `profiles` from Supabase Auth.
--
-- The app no longer uses Supabase Auth (magic links). Identity is a single
-- hardcoded credential and data is accessed through the service-role client,
-- which bypasses RLS. The existing `auth.uid()` RLS policies are left in place
-- (harmlessly bypassed) so nothing has to be rewritten.
--
-- Because every app table FKs to `profiles(id)`, the lone fixed user must exist
-- as a `profiles` row. That row's id can no longer reference `auth.users`, so we
-- drop that foreign key first, then seed the single profile.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

insert into public.profiles (id, email, is_allowed)
values ('00000000-0000-4000-8000-0000000f0001', 'roops21', true)
on conflict (id) do nothing;
