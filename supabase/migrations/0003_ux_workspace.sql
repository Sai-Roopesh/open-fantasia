alter table public.ai_connections
  add column if not exists health_status text not null default 'untested'
    check (health_status in ('untested', 'healthy', 'auth_failed', 'bad_base_url', 'rate_limited', 'error')),
  add column if not exists health_message text not null default '',
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_model_refresh_at timestamptz;

update public.ai_connections
set
  health_status = case
    when jsonb_array_length(model_cache) > 0 then 'healthy'
    else 'untested'
  end,
  last_model_refresh_at = coalesce(last_model_refresh_at, last_synced_at)
where health_status = 'untested'
  or last_model_refresh_at is null;

alter table public.chat_threads
  add column if not exists archived_at timestamptz,
  add column if not exists pinned_at timestamptz;

update public.chat_threads
set archived_at = coalesce(archived_at, updated_at)
where status = 'archived'
  and archived_at is null;

create index if not exists idx_ai_connections_health_status
  on public.ai_connections(user_id, health_status, updated_at desc);

create index if not exists idx_chat_threads_pinned_updated
  on public.chat_threads(user_id, pinned_at desc nulls last, updated_at desc);

create index if not exists idx_chat_threads_archived
  on public.chat_threads(user_id, status, archived_at desc nulls last, updated_at desc);
