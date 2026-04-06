import type { UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export const providerIds = [
  "google",
  "groq",
  "mistral",
  "openrouter",
  "ollama",
] as const;

export type ProviderId = (typeof providerIds)[number];

type PublicTables = Database["public"]["Tables"];
export type DbTableName = keyof PublicTables;
export type DbRow<TableName extends DbTableName> = PublicTables[TableName]["Row"];
export type DbInsert<TableName extends DbTableName> = PublicTables[TableName]["Insert"];
export type DbUpdate<TableName extends DbTableName> = PublicTables[TableName]["Update"];

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

export type ConnectionRecord = Omit<DbRow<"ai_connections">, "model_cache"> & {
  model_cache: ModelCatalogEntry[];
};

export type ConnectionInsert = Omit<DbInsert<"ai_connections">, "model_cache"> & {
  model_cache?: ModelCatalogEntry[];
};

export type CharacterRecord = DbRow<"characters">;
export type CharacterInsert = DbInsert<"characters">;
export type CharacterStarterRecord = DbRow<"character_starters">;
export type CharacterExampleConversationRecord =
  DbRow<"character_example_conversations">;
export type UserPersonaRecord = DbRow<"user_personas">;
export type ThreadRecord = DbRow<"chat_threads">;
export type ChatBranchRecord = DbRow<"chat_branches">;
export type ChatCheckpointRecord = DbRow<"chat_checkpoints">;
export type TimelineEventRecord = DbRow<"chat_timeline_events">;
export type ChatPinRecord = DbRow<"chat_pins">;
export type BackgroundJobRecord = DbRow<"background_jobs">;

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
    hiddenFromTranscript: z.boolean().optional(),
    starterSeed: z.boolean().optional(),
  })
  .default({});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type FantasiaUIMessage = UIMessage<MessageMetadata>;

export type StoredMessageRecord = Omit<
  DbRow<"chat_messages">,
  "parts" | "metadata"
> & {
  parts: unknown[];
  metadata: MessageMetadata | null;
};

export type ThreadStateSnapshot = Omit<
  DbRow<"chat_state_snapshots">,
  "user_facts" | "open_loops" | "scene_goals"
> & {
  user_facts: string[];
  open_loops: string[];
  scene_goals: string[];
};

export type TranscriptControl = {
  checkpointId: string;
  branchId: string;
  canEdit: boolean;
  canRegenerate: boolean;
  canBranch: boolean;
  canRewind: boolean;
  canPin: boolean;
  canRate: boolean;
  feedbackRating: number | null;
  alternates: Array<{
    checkpointId: string;
    selected: boolean;
    label: string;
  }>;
};

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
  continuityStatus:
    | {
        tone: "pending";
        title: string;
        detail: string;
      }
    | null;
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

export type ThreadGenerationSettings = {
  temperature: number;
  topP: number;
  maxOutputTokens: number;
};

export type JobPayload = {
  threadId: string;
  branchId: string;
  checkpointId: string;
  previousCheckpointId: string | null;
  connectionId: string;
  modelId: string;
  characterId: string;
  personaId: string | null;
  recentMessageIds: string[];
};
