import type { CharacterRecord, ThreadGenerationSettings, ThreadRecord } from "@/lib/types";

export function resolveThreadGenerationSettings(args: {
  character: CharacterRecord;
  thread: ThreadRecord;
}): ThreadGenerationSettings {
  return {
    temperature: args.thread.temperature_override ?? args.character.temperature,
    topP: args.thread.top_p_override ?? args.character.top_p,
    maxOutputTokens:
      args.thread.max_output_tokens_override ?? args.character.max_output_tokens,
  };
}
