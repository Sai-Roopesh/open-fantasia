import { z } from "zod";
import { providerIds } from "@/lib/types";

export const chatRequestSchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(
    z.object({
      id: z.string().min(1),
      role: z.enum(["user", "assistant", "system", "data"]),
      createdAt: z.union([z.string(), z.date()]).optional(),
      annotations: z.array(z.unknown()).optional(),
      data: z.unknown().optional(),
    }).passthrough()
  ),
});

export const regenerateRequestSchema = z.object({
  checkpointId: z.string().uuid().optional(),
});

export const editMessageRequestSchema = z.object({
  content: z.string().trim().min(1),
});

export const createBranchRequestSchema = z.object({
  checkpointId: z.string().uuid(),
  name: z.string().trim().min(1),
  makeActive: z.boolean().default(true),
});

export const createPinRequestSchema = z.object({
  sourceMessageId: z.string().min(1).nullable().optional(),
  body: z.string().trim().min(1),
});

export const connectionRequestSchema = z.object({
  connectionId: z.string().uuid(),
});

export const rateCheckpointRequestSchema = z.object({
  rating: z.number().int().min(1).max(4),
});

export const starterSeedRequestSchema = z.object({
  starter: z.string().trim().min(1),
});

export const saveConnectionCommandSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.enum(providerIds),
  label: z.string().trim().min(1),
  baseUrl: z.string().trim().nullish(),
  apiKey: z.string().trim().nullish(),
  enabled: z.boolean().default(true),
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const savePersonaCommandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  identity: z.string().default(""),
  backstory: z.string().default(""),
  voice_style: z.string().default(""),
  goals: z.string().default(""),
  boundaries: z.string().default(""),
  private_notes: z.string().default(""),
  is_default: z.boolean().default(false),
});

export const saveCharacterCommandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  appearance: z.string().default(""),
  tagline: z.string().default(""),
  short_description: z.string().default(""),
  long_description: z.string().default(""),
  greeting: z.string().default(""),
  core_persona: z.string().default(""),
  style_rules: z.string().default(""),
  scenario_seed: z.string().default(""),
  author_notes: z.string().default(""),
  definition: z.string().default(""),
  negative_guidance: z.string().default(""),
  temperature: z.coerce.number().min(0).max(2).default(0.92),
  top_p: z.coerce.number().gt(0).lte(1).default(0.94),
  max_output_tokens: z.coerce.number().int().positive().default(750),
  starters: z.array(z.string()).default([]),
  exampleConversations: z
    .array(
      z.object({
        user_line: z.string().default(""),
        character_line: z.string().default(""),
      }),
    )
    .default([]),
});

export const threadRenameCommandSchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().trim().min(1),
});

export const threadStatusCommandSchema = z.object({
  threadId: z.string().uuid(),
  status: z.enum(["active", "archived"]),
});

export const threadPinnedCommandSchema = z.object({
  threadId: z.string().uuid(),
  pinned: z.boolean(),
});

export const threadDeleteCommandSchema = z.object({
  threadId: z.string().uuid(),
});

export const personaCommandSchema = z.object({
  personaId: z.string().uuid(),
});

export const characterDeleteCommandSchema = z.object({
  characterId: z.string().uuid(),
});

export const startThreadCommandSchema = z.object({
  characterId: z.string().uuid(),
});

export const switchThreadModelSchema = z.object({
  threadId: z.string().uuid(),
  connectionId: z.string().uuid(),
  modelId: z.string().min(1),
});

export const switchThreadPersonaSchema = z.object({
  threadId: z.string().uuid(),
  personaId: z.string().uuid(),
});

export const switchThreadBranchSchema = z.object({
  threadId: z.string().uuid(),
  branchId: z.string().uuid(),
});

export const reconcileCheckpointJobPayloadSchema = z.object({
  threadId: z.string().uuid(),
  branchId: z.string().uuid(),
  checkpointId: z.string().uuid(),
  previousCheckpointId: z.string().uuid().nullable(),
  connectionId: z.string().uuid(),
  modelId: z.string().min(1),
  characterId: z.string().uuid(),
  personaId: z.string().uuid().nullable(),
  recentMessageIds: z.array(z.string().min(1)),
});

export const generateCharacterPortraitJobPayloadSchema = z.object({
  characterId: z.string().uuid(),
  prompt: z.string().trim().min(1),
  seed: z.number().int().nonnegative(),
  sourceHash: z.string().trim().min(1),
});

export const jobPayloadSchema = reconcileCheckpointJobPayloadSchema;

export const backgroundJobRecordSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  user_id: z.string().uuid(),
  thread_id: z.string().uuid().nullable(),
  branch_id: z.string().uuid().nullable(),
  checkpoint_id: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  available_at: z.string().min(1),
  locked_at: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export function parseFormBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
