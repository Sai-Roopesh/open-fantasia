truncate table
  public.background_jobs,
  public.chat_state_snapshots,
  public.chat_timeline_events,
  public.chat_pins,
  public.chat_checkpoints,
  public.chat_messages,
  public.chat_branches,
  public.chat_threads
restart identity cascade;

alter table public.chat_messages
  drop constraint if exists chat_messages_id_nonempty;

alter table public.chat_messages
  add constraint chat_messages_id_nonempty
  check (length(btrim(id)) > 0);

alter table public.chat_checkpoints
  drop constraint if exists chat_checkpoints_user_message_id_nonempty;

alter table public.chat_checkpoints
  add constraint chat_checkpoints_user_message_id_nonempty
  check (length(btrim(user_message_id)) > 0);

alter table public.chat_checkpoints
  drop constraint if exists chat_checkpoints_assistant_message_id_nonempty;

alter table public.chat_checkpoints
  add constraint chat_checkpoints_assistant_message_id_nonempty
  check (length(btrim(assistant_message_id)) > 0);

alter table public.chat_checkpoints
  drop constraint if exists chat_checkpoints_choice_group_key_nonempty;

alter table public.chat_checkpoints
  add constraint chat_checkpoints_choice_group_key_nonempty
  check (length(btrim(choice_group_key)) > 0);
