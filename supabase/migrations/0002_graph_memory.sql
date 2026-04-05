create table if not exists public.user_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  identity text not null default '',
  backstory text not null default '',
  voice_style text not null default '',
  goals text not null default '',
  boundaries text not null default '',
  private_notes text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters
  add column if not exists tagline text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists long_description text not null default '',
  add column if not exists definition text not null default '',
  add column if not exists negative_guidance text not null default '';

create table if not exists public.character_starters (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_example_conversations (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_line text not null default '',
  character_line text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_branches (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  name text not null,
  parent_branch_id uuid references public.chat_branches(id) on delete set null,
  fork_checkpoint_id uuid,
  head_checkpoint_id uuid,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_threads
  add column if not exists persona_id uuid references public.user_personas(id) on delete set null,
  add column if not exists active_branch_id uuid;

create table if not exists public.chat_checkpoints (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  branch_id uuid not null references public.chat_branches(id) on delete cascade,
  parent_checkpoint_id uuid references public.chat_checkpoints(id) on delete set null,
  user_message_id text not null references public.chat_messages(id) on delete cascade,
  assistant_message_id text not null references public.chat_messages(id) on delete cascade,
  choice_group_key text not null,
  feedback_rating integer check (feedback_rating between 1 and 4),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'chat_state_snapshots'
  ) then
    drop table public.chat_state_snapshots cascade;
  end if;
end $$;

create table if not exists public.chat_state_snapshots (
  checkpoint_id uuid primary key references public.chat_checkpoints(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  branch_id uuid not null references public.chat_branches(id) on delete cascade,
  based_on_snapshot_id uuid references public.chat_state_snapshots(checkpoint_id) on delete set null,
  scenario_state text not null default '',
  relationship_state text not null default '',
  rolling_summary text not null default '',
  user_facts jsonb not null default '[]'::jsonb,
  open_loops jsonb not null default '[]'::jsonb,
  scene_goals jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_pins (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  branch_id uuid not null references public.chat_branches(id) on delete cascade,
  source_message_id text references public.chat_messages(id) on delete set null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_timeline_events
  add column if not exists branch_id uuid references public.chat_branches(id) on delete cascade,
  add column if not exists checkpoint_id uuid references public.chat_checkpoints(id) on delete set null;

create index if not exists idx_user_personas_user_id on public.user_personas(user_id);
create unique index if not exists idx_user_personas_default_unique
  on public.user_personas(user_id)
  where is_default = true;
create index if not exists idx_character_starters_character_id on public.character_starters(character_id, sort_order);
create index if not exists idx_character_examples_character_id on public.character_example_conversations(character_id, sort_order);
create index if not exists idx_chat_branches_thread_id on public.chat_branches(thread_id, updated_at desc);
create index if not exists idx_chat_checkpoints_branch_id on public.chat_checkpoints(branch_id, created_at);
create index if not exists idx_chat_checkpoints_choice_group on public.chat_checkpoints(choice_group_key, created_at);
create index if not exists idx_chat_state_snapshots_branch_id on public.chat_state_snapshots(branch_id, updated_at desc);
create index if not exists idx_chat_pins_branch_id on public.chat_pins(branch_id, created_at desc);
create index if not exists idx_chat_timeline_branch_id on public.chat_timeline_events(branch_id, created_at desc);

drop trigger if exists set_user_personas_updated_at on public.user_personas;
create trigger set_user_personas_updated_at
before update on public.user_personas
for each row execute procedure public.set_updated_at();

drop trigger if exists set_character_starters_updated_at on public.character_starters;
create trigger set_character_starters_updated_at
before update on public.character_starters
for each row execute procedure public.set_updated_at();

drop trigger if exists set_character_examples_updated_at on public.character_example_conversations;
create trigger set_character_examples_updated_at
before update on public.character_example_conversations
for each row execute procedure public.set_updated_at();

drop trigger if exists set_chat_branches_updated_at on public.chat_branches;
create trigger set_chat_branches_updated_at
before update on public.chat_branches
for each row execute procedure public.set_updated_at();

drop trigger if exists set_chat_pins_updated_at on public.chat_pins;
create trigger set_chat_pins_updated_at
before update on public.chat_pins
for each row execute procedure public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'chat_threads'
      and constraint_name = 'chat_threads_active_branch_id_fkey'
  ) then
    alter table public.chat_threads
      add constraint chat_threads_active_branch_id_fkey
      foreign key (active_branch_id)
      references public.chat_branches(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'chat_branches'
      and constraint_name = 'chat_branches_fork_checkpoint_id_fkey'
  ) then
    alter table public.chat_branches
      add constraint chat_branches_fork_checkpoint_id_fkey
      foreign key (fork_checkpoint_id)
      references public.chat_checkpoints(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'chat_branches'
      and constraint_name = 'chat_branches_head_checkpoint_id_fkey'
  ) then
    alter table public.chat_branches
      add constraint chat_branches_head_checkpoint_id_fkey
      foreign key (head_checkpoint_id)
      references public.chat_checkpoints(id)
      on delete set null;
  end if;
end $$;

alter table public.user_personas enable row level security;
alter table public.character_starters enable row level security;
alter table public.character_example_conversations enable row level security;
alter table public.chat_branches enable row level security;
alter table public.chat_checkpoints enable row level security;
alter table public.chat_state_snapshots enable row level security;
alter table public.chat_pins enable row level security;

create policy "personas own rows"
on public.user_personas
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "starters via owned characters"
on public.character_starters
for all
using (
  exists (
    select 1
    from public.characters characters
    where characters.id = character_starters.character_id
      and characters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.characters characters
    where characters.id = character_starters.character_id
      and characters.user_id = auth.uid()
  )
);

create policy "examples via owned characters"
on public.character_example_conversations
for all
using (
  exists (
    select 1
    from public.characters characters
    where characters.id = character_example_conversations.character_id
      and characters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.characters characters
    where characters.id = character_example_conversations.character_id
      and characters.user_id = auth.uid()
  )
);

create policy "branches via owned threads"
on public.chat_branches
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_branches.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_branches.thread_id
      and threads.user_id = auth.uid()
  )
);

create policy "checkpoints via owned threads"
on public.chat_checkpoints
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_checkpoints.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_checkpoints.thread_id
      and threads.user_id = auth.uid()
  )
);

create policy "snapshots via owned threads v2"
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

create policy "pins via owned threads"
on public.chat_pins
for all
using (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_pins.thread_id
      and threads.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads threads
    where threads.id = chat_pins.thread_id
      and threads.user_id = auth.uid()
  )
);
