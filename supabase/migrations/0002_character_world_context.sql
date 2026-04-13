alter table public.characters
add column if not exists world_context text not null default '';
