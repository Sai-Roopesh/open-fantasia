import type { CharacterRecord, ThreadGenerationSettings, ThreadRecord } from "@/lib/types";

export function resolveThreadGenerationSettings(args: {
  character: CharacterRecord;
  thread: ThreadRecord;
}): ThreadGenerationSettings {
  return {
    temperature: args.character.temperature,
    topP: args.character.top_p,
    maxOutputTokens: args.character.max_output_tokens,
  };
}
