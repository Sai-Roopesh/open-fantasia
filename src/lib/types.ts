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

export const connectionHealthStatuses = [
  "untested",
  "healthy",
  "auth_failed",
  "rate_limited",
  "bad_base_url",
  "bad_config",
  "needs_attention",
  "error",
] as const;

export type ConnectionHealthStatus = (typeof connectionHealthStatuses)[number];

export const turnGenerationStatuses = [
  "reserved",
  "streaming",
  "committed",
  "failed",
] as const;

export type TurnGenerationStatus = (typeof turnGenerationStatuses)[number];

export const editableTurnTargets = ["user", "assistant"] as const;

export type EditableTurnTarget = (typeof editableTurnTargets)[number];

export const taskStatuses = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

type PublicTables = Database["public"]["Tables"];
export type DbTableName = keyof PublicTables;
export type DbRow<TableName extends DbTableName> = PublicTables[TableName]["Row"];
export type DbInsert<TableName extends DbTableName> = PublicTables[TableName]["Insert"];
export type DbUpdate<TableName extends DbTableName> = PublicTables[TableName]["Update"];

export const characterStarterSchema = z.object({
  text: z.string(),
});

export const characterExampleConversationSchema = z.object({
  user_line: z.string(),
  character_line: z.string(),
});

export type CharacterStarter = z.infer<typeof characterStarterSchema>;
export type CharacterExampleConversation = z.infer<
  typeof characterExampleConversationSchema
>;

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

export type ProfileRecord = DbRow<"profiles">;

export type ConnectionRecord = Omit<DbRow<"ai_connections">, "model_cache"> & {
  provider: ProviderId;
  health_status: ConnectionHealthStatus;
  model_cache: ModelCatalogEntry[];
};

export type UserPersonaRecord = DbRow<"user_personas">;

export type CharacterRecord = Omit<
  DbRow<"characters">,
  "starters" | "example_conversations"
> & {
  starters: CharacterStarter[];
  example_conversations: CharacterExampleConversation[];
};
export type CharacterPortraitStatus = CharacterRecord["portrait_status"];

export type ThreadRecord = DbRow<"chat_threads">;
export type ChatBranchRecord = DbRow<"chat_branches">;
export type ChatTurnRecord = DbRow<"chat_turns"> & {
  generation_status: TurnGenerationStatus;
};
export type TimelineEventRecord = DbRow<"chat_timeline_events">;
export type ChatPinRecord = DbRow<"chat_pins">;
export type CharacterPortraitTaskRecord = DbRow<"character_portrait_tasks"> & {
  status: TaskStatus;
};

export type TurnSnapshotRecord = Omit<
  DbRow<"chat_turn_snapshots">,
  "user_facts" | "active_threads" | "resolved_threads" | "next_turn_pressure" | "scene_goals"
> & {
  user_facts: string[];
  active_threads: string[];
  resolved_threads: string[];
  next_turn_pressure: string[];
  scene_goals: string[];
};
export type ThreadStateSnapshot = TurnSnapshotRecord;

export const messageMetadataSchema = z
  .object({
    model: z.string().optional(),
    provider: z.string().optional(),
    connectionLabel: z.string().optional(),
    createdAt: z.string().optional(),
    startedAt: z.number().optional(),
    totalTokens: z.number().optional(),
    finishReason: z.string().optional(),
    turnId: z.string().optional(),
    branchId: z.string().optional(),
    hiddenFromTranscript: z.boolean().optional(),
    starterSeed: z.boolean().optional(),
  })
  .default({});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
export type FantasiaUIMessage = UIMessage<MessageMetadata>;

export type TranscriptControl = {
  turnId: string;
  branchId: string;
  canEdit: boolean;
  canRegenerate: boolean;
  canBranch: boolean;
  canRewind: boolean;
  canPin: boolean;
  canRate: boolean;
  feedbackRating: number | null;
};

export const reconciliationSchema = z.object({
  storySummary: z.string().default(""),
  sceneSummary: z.string().default(""),
  lastTurnBeat: z.string().default(""),
  relationshipState: z.string().default(""),
  userFacts: z.array(z.string()).default([]),
  activeThreads: z.array(z.string()).default([]),
  resolvedThreads: z.array(z.string()).default([]),
  nextTurnPressure: z.array(z.string()).default([]),
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
  character_name: string | null;
  persona_name: string | null;
  active_branch_id: string | null;
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
  status: ConnectionHealthStatus;
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
        tone: "pending" | "error";
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
    forkTurnId: string | null;
    headTurnId: string | null;
    totalBranches: number;
    totalTurns: number;
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

export type CharacterPortraitPayload = {
  characterId: string;
  prompt: string;
  seed: number;
  sourceHash: string;
};
