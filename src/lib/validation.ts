import { z } from "zod";
import { connectionHealthStatuses, providerIds, taskStatuses, turnGenerationStatuses } from "@/lib/types";

const MAX_USER_TEXT = 4_000;
const MAX_LABEL = 80;
const MAX_NAME = 120;
const MAX_SHORT_TEXT = 500;
const MAX_MEDIUM_TEXT = 2_000;
const MAX_STARTERS = 20;
const MAX_EXAMPLES = 20;

export const chatTurnRequestSchema = z.object({
  branchId: z.string().uuid(),
  expectedHeadTurnId: z.string().uuid().nullable().optional(),
  text: z.string().trim().min(1).max(MAX_USER_TEXT),
});

export const regenerateTurnRequestSchema = z.object({
  branchId: z.string().uuid(),
  expectedHeadTurnId: z.string().uuid(),
});

export const editTurnRequestSchema = z.object({
  branchId: z.string().uuid(),
  expectedHeadTurnId: z.string().uuid(),
  text: z.string().trim().min(1).max(MAX_USER_TEXT),
});

export const createBranchRequestSchema = z.object({
  sourceTurnId: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_LABEL),
  makeActive: z.boolean().default(true),
});

export const createPinRequestSchema = z.object({
  turnId: z.string().uuid(),
  body: z.string().trim().min(1).max(MAX_SHORT_TEXT),
});

export const connectionRequestSchema = z.object({
  connectionId: z.string().uuid(),
});

export const rateTurnRequestSchema = z.object({
  rating: z.number().int().min(1).max(4),
});

export const starterSeedRequestSchema = z.object({
  starter: z.string().trim().min(1).max(MAX_MEDIUM_TEXT),
});

export const saveConnectionCommandSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.enum(providerIds),
  label: z.string().trim().min(1).max(MAX_LABEL),
  baseUrl: z.string().trim().nullish(),
  apiKey: z.string().trim().nullish(),
  enabled: z.boolean().default(true),
  defaultModelId: z.string().trim().min(1).nullish(),
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const savePersonaCommandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(MAX_NAME),
  identity: z.string().default(""),
  backstory: z.string().default(""),
  voice_style: z.string().default(""),
  goals: z.string().default(""),
  boundaries: z.string().default(""),
  private_notes: z.string().default(""),
  is_default: z.boolean().default(false),
});

const starterSchema = z.string().trim().min(1);
const exampleSchema = z.object({
  user_line: z.string().default(""),
  character_line: z.string().default(""),
});

export const saveCharacterCommandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(MAX_NAME),
  story: z.string().default(""),
  core_persona: z.string().default(""),
  greeting: z.string().default(""),
  appearance: z.string().default(""),
  style_rules: z.string().default(""),
  definition: z.string().default(""),
  negative_guidance: z.string().default(""),
  temperature: z.coerce.number().min(0).max(2).default(0.92),
  top_p: z.coerce.number().gt(0).lte(1).default(0.94),
  max_output_tokens: z.coerce.number().int().positive().max(4_096).default(750),
  starters: z.array(starterSchema).max(MAX_STARTERS).default([]),
  exampleConversations: z.array(exampleSchema).max(MAX_EXAMPLES).default([]),
});

export const threadRenameCommandSchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().trim().min(1).max(MAX_NAME),
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
  personaId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
  modelId: z.string().trim().min(1).optional(),
});

export const switchThreadModelSchema = z.object({
  threadId: z.string().uuid(),
  connectionId: z.string().uuid(),
  modelId: z.string().trim().min(1),
});

export const switchThreadPersonaSchema = z.object({
  threadId: z.string().uuid(),
  personaId: z.string().uuid(),
});

export const switchThreadBranchSchema = z.object({
  threadId: z.string().uuid(),
  branchId: z.string().uuid(),
});

export const turnRecordSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_origin_id: z.string().uuid(),
  parent_turn_id: z.string().uuid().nullable(),
  user_input_text: z.string(),
  user_input_payload: z.unknown(),
  user_input_hidden: z.boolean(),
  starter_seed: z.boolean(),
  assistant_output_text: z.string().nullable(),
  assistant_output_payload: z.unknown().nullable(),
  generation_status: z.enum(turnGenerationStatuses),
  reserved_by_user_id: z.string().uuid(),
  assistant_provider: z.string().nullable(),
  assistant_model: z.string().nullable(),
  assistant_connection_label: z.string().nullable(),
  finish_reason: z.string().nullable(),
  total_tokens: z.number().nullable(),
  prompt_tokens: z.number().nullable(),
  completion_tokens: z.number().nullable(),
  feedback_rating: z.number().int().nullable(),
  generation_started_at: z.string(),
  generation_finished_at: z.string().nullable(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const branchRecordSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  name: z.string(),
  parent_branch_id: z.string().uuid().nullable(),
  fork_turn_id: z.string().uuid().nullable(),
  head_turn_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  generation_locked: z.boolean(),
  locked_by_turn_id: z.string().uuid().nullable(),
  locked_at: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const snapshotRecordSchema = z.object({
  turn_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  based_on_turn_id: z.string().uuid().nullable(),
  scenario_state: z.string(),
  relationship_state: z.string(),
  rolling_summary: z.string(),
  user_facts: z.array(z.string()),
  open_loops: z.array(z.string()),
  resolved_loops: z.array(z.string()),
  narrative_hooks: z.array(z.string()),
  scene_goals: z.array(z.string()),
  version: z.number().int().positive(),
  updated_at: z.string(),
});

export const reconcileTaskRecordSchema = z.object({
  id: z.string().uuid(),
  turn_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  user_id: z.string().uuid(),
  connection_id: z.string().uuid(),
  model_id: z.string(),
  character_id: z.string().uuid(),
  persona_id: z.string().uuid(),
  status: z.enum(taskStatuses),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  available_at: z.string(),
  locked_at: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const portraitTaskRecordSchema = z.object({
  id: z.string().uuid(),
  character_id: z.string().uuid(),
  user_id: z.string().uuid(),
  prompt: z.string(),
  seed: z.number().int().nonnegative(),
  source_hash: z.string(),
  status: z.enum(taskStatuses),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  available_at: z.string(),
  locked_at: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const connectionRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.enum(providerIds),
  label: z.string(),
  base_url: z.string().nullable(),
  encrypted_api_key: z.string().nullable(),
  enabled: z.boolean(),
  default_model_id: z.string().nullable(),
  model_cache: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      provider: z.enum(providerIds),
      contextWindow: z.number().optional(),
      hint: z.string().optional(),
    }),
  ),
  health_status: z.enum(connectionHealthStatuses),
  health_message: z.string(),
  last_checked_at: z.string().nullable(),
  last_model_refresh_at: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function parseFormBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
