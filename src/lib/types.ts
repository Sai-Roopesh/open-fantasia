import type { UIMessage } from "ai";
import { z } from "zod";

export const providerIds = [
  "google",
  "groq",
  "mistral",
  "openrouter",
  "ollama",
] as const;

export type ProviderId = (typeof providerIds)[number];

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: ProviderId;
  contextWindow?: number;
  hint?: string;
};

export type ProviderCatalog = {
  id: ProviderId;
  name: string;
  description: string;
  setupUrl: string;
  requiresKey: boolean;
  defaultBaseUrl?: string;
};

export type ConnectionRecord = {
  id: string;
  user_id: string;
  provider: ProviderId;
  label: string;
  base_url: string | null;
  encrypted_api_key: string | null;
  enabled: boolean;
  model_cache: ModelCatalogEntry[];
  health_status:
    | "untested"
    | "healthy"
    | "auth_failed"
    | "bad_base_url"
    | "rate_limited"
    | "error";
  health_message: string;
  last_checked_at: string | null;
  last_model_refresh_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CharacterRecord = {
  id: string;
  user_id: string;
  name: string;
  tagline: string;
  short_description: string;
  long_description: string;
  greeting: string;
  core_persona: string;
  style_rules: string;
  scenario_seed: string;
  example_dialogue: string;
  author_notes: string;
  definition: string;
  negative_guidance: string;
  created_at: string;
  updated_at: string;
};

export type CharacterStarterRecord = {
  id: string;
  character_id: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CharacterExampleConversationRecord = {
  id: string;
  character_id: string;
  user_line: string;
  character_line: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type UserPersonaRecord = {
  id: string;
  user_id: string;
  name: string;
  identity: string;
  backstory: string;
  voice_style: string;
  goals: string;
  boundaries: string;
  private_notes: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ThreadRecord = {
  id: string;
  user_id: string;
  character_id: string;
  connection_id: string;
  model_id: string;
  persona_id: string | null;
  active_branch_id: string | null;
  title: string;
  status: "active" | "archived";
  archived_at: string | null;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredMessageRecord = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
  content_text: string;
  metadata: MessageMetadata | null;
  created_at: string;
};

export type ThreadStateSnapshot = {
  checkpoint_id: string;
  thread_id: string;
  branch_id: string;
  based_on_snapshot_id: string | null;
  scenario_state: string;
  relationship_state: string;
  rolling_summary: string;
  user_facts: string[];
  open_loops: string[];
  scene_goals: string[];
  version: number;
  updated_at: string;
};

export type TimelineEventRecord = {
  id: string;
  thread_id: string;
  branch_id: string | null;
  checkpoint_id: string | null;
  source_message_id: string | null;
  title: string;
  detail: string;
  importance: number;
  created_at: string;
};

export type ChatBranchRecord = {
  id: string;
  thread_id: string;
  name: string;
  parent_branch_id: string | null;
  fork_checkpoint_id: string | null;
  head_checkpoint_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ChatCheckpointRecord = {
  id: string;
  thread_id: string;
  branch_id: string;
  parent_checkpoint_id: string | null;
  user_message_id: string;
  assistant_message_id: string;
  choice_group_key: string;
  feedback_rating: number | null;
  created_by: string;
  created_at: string;
};

export type ChatPinRecord = {
  id: string;
  thread_id: string;
  branch_id: string;
  source_message_id: string | null;
  body: string;
  status: "active" | "resolved";
  created_at: string;
  updated_at: string;
};

export const messageMetadataSchema = z
  .object({
    model: z.string().optional(),
    provider: z.string().optional(),
    connectionLabel: z.string().optional(),
    createdAt: z.string().optional(),
    startedAt: z.number().optional(),
    totalTokens: z.number().optional(),
    finishReason: z.string().optional(),
    checkpointId: z.string().optional(),
    branchId: z.string().optional(),
    choiceGroupKey: z.string().optional(),
  })
  .default({});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type FantasiaUIMessage = UIMessage<MessageMetadata>;

export const reconciliationSchema = z.object({
  scenarioState: z.string().default(""),
  relationshipState: z.string().default(""),
  rollingSummary: z.string().default(""),
  userFacts: z.array(z.string()).default([]),
  openLoops: z.array(z.string()).default([]),
  sceneGoals: z.array(z.string()).default([]),
  timelineEvent: z
    .object({
      title: z.string(),
      detail: z.string(),
      importance: z.number().min(1).max(5).default(3),
    })
    .optional(),
});

export type ReconciliationOutput = z.infer<typeof reconciliationSchema>;

export type ThreadListItem = ThreadRecord & {
  characters?: { name?: string } | null;
  user_personas?: { name?: string } | null;
};

export type DashboardReadiness = {
  hasDefaultPersona: boolean;
  hasProvider: boolean;
  hasHealthyProvider: boolean;
  hasRefreshedModels: boolean;
  hasCharacter: boolean;
  hasThread: boolean;
  completedSteps: number;
  totalSteps: number;
  nextHref: string;
  nextLabel: string;
};

export type ProviderHealth = {
  status: ConnectionRecord["health_status"];
  message: string;
  lastCheckedAt: string | null;
  lastModelRefreshAt: string | null;
};

export type PersonaUsageSummary = {
  personaId: string;
  totalThreads: number;
  activeThreads: number;
};

export type ContinuityInspectorView = {
  continuity: Array<{
    label: string;
    value: string;
    helper: string;
  }>;
  pins: Array<{
    id: string;
    body: string;
    createdAt: string;
    sourceLabel: string;
    sourceExcerpt: string;
  }>;
  timeline: Array<{
    id: string;
    title: string;
    detail: string;
    importance: number;
    createdAt: string;
  }>;
  branch: {
    activeBranchId: string;
    activeBranchName: string;
    parentBranchName: string | null;
    forkCheckpointId: string | null;
    headCheckpointId: string | null;
    totalBranches: number;
    totalCheckpoints: number;
    alternateCount: number;
  };
};

export type CharacterDraftState = {
  dirty: boolean;
  restoredFromLocalDraft: boolean;
  activeTab: string;
};
