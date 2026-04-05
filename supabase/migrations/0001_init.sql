create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'groq', 'mistral', 'openrouter', 'ollama')),
  label text not null,
  base_url text,
  encrypted_api_key text,
  enabled boolean not null default true,
  model_cache jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  greeting text not null default '',
  core_persona text not null default '',
  style_rules text not null default '',
  scenario_seed text not null default '',
  example_dialogue text not null default '',
  author_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  connection_id uuid not null references public.ai_connections(id) on delete restrict,
  model_id text not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id text primary key,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null default '[]'::jsonb,
  content_text text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_state_snapshots (
  thread_id uuid primary key references public.chat_threads(id) on delete cascade,
  scenario_state text not null default '',
  relationship_state text not null default '',
  rolling_summary text not null default '',
  user_facts jsonb not null default '[]'::jsonb,
  open_loops jsonb not null default '[]'::jsonb,
  scene_goals jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_timeline_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  source_message_id text references public.chat_messages(id) on delete set null,
  title text not null,
  detail text not null,
  importance integer not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_connections_user_id on public.ai_connections(user_id);
create index if not exists idx_characters_user_id on public.characters(user_id);
create index if not exists idx_chat_threads_user_id on public.chat_threads(user_id);
create index if not exists idx_chat_messages_thread_id on public.chat_messages(thread_id, created_at);
create index if not exists idx_chat_timeline_thread_id on public.chat_timeline_events(thread_id, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_ai_connections_updated_at on public.ai_connections;
create trigger set_ai_connections_updated_at
before update on public.ai_connections
for each row execute procedure public.set_updated_at();

drop trigger if exists set_characters_updated_at on public.characters;
create trigger set_characters_updated_at
before update on public.characters
for each row execute procedure public.set_updated_at();

drop trigger if exists set_chat_threads_updated_at on public.chat_threads;
create trigger set_chat_threads_updated_at
before update on public.chat_threads
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.ai_connections enable row level security;
alter table public.characters enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_state_snapshots enable row level security;
alter table public.chat_timeline_events enable row level security;

create policy "profiles own rows"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "connections own rows"
on public.ai_connections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "characters own rows"
on public.characters
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "threads own rows"
on public.chat_threads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "messages via owned threads"
on public.chat_messages
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_messages.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_messages.thread_id
      and threads.user_id = auth.uid()
  )
);

create policy "snapshots via owned threads"
on public.chat_state_snapshots
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_state_snapshots.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_state_snapshots.thread_id
      and threads.user_id = auth.uid()
  )
);

create policy "timeline via owned threads"
on public.chat_timeline_events
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_timeline_events.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_timeline_events.thread_id
      and threads.user_id = auth.uid()
  )
);
