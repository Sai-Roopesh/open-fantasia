truncate table public.chat_turn_snapshots;

alter table public.chat_turn_snapshots
  rename column scenario_state to scene_summary;

alter table public.chat_turn_snapshots
  rename column rolling_summary to story_summary;

alter table public.chat_turn_snapshots
  rename column open_loops to active_threads;

alter table public.chat_turn_snapshots
  rename column resolved_loops to resolved_threads;

alter table public.chat_turn_snapshots
  rename column narrative_hooks to next_turn_pressure;

alter table public.chat_turn_snapshots
  add column last_turn_beat text not null default '';
