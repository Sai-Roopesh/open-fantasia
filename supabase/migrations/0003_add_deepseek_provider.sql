-- Add 'deepseek' to the ai_connections provider check constraint.

ALTER TABLE public.ai_connections DROP CONSTRAINT IF EXISTS ai_connections_provider_check;

ALTER TABLE public.ai_connections ADD CONSTRAINT ai_connections_provider_check
  CHECK (provider = ANY (ARRAY[
    'google'::text, 'groq'::text, 'mistral'::text,
    'openrouter'::text, 'ollama'::text, 'deepseek'::text
  ]));
