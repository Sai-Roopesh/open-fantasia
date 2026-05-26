-- Add max_output_tokens column to public.chat_threads
ALTER TABLE public.chat_threads 
  ADD COLUMN IF NOT EXISTS max_output_tokens integer DEFAULT 4096 NOT NULL;

-- Remove max_output_tokens from public.characters
ALTER TABLE public.characters
  DROP COLUMN IF EXISTS max_output_tokens;
