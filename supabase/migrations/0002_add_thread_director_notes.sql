-- Per-thread "director's notes": free-text instructions injected into this
-- thread's system prompt only (a per-thread override layered on top of the
-- character/persona/universal rules). Defaults to empty so existing threads and
-- create_thread_with_branch (which does not set it) are unaffected.
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS director_notes text NOT NULL DEFAULT '';
