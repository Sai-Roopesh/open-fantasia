import type { UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export const providerIds = [
  "google",
  "groq",
  "mistral",
  "openrouter",
  "ollama",
  "deepseek",
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

/**
 * The switchable thread-level settings the chat workspace renders. Built once on
 * the server and applied optimistically on the client so selectors never snap back.
 */
export type ThreadSettingsSlice = {
  model: { connectionId: string; modelId: string; label: string };
  personaId: string;
  brain: { connectionId: string | null; modelId: string | null };
  maxOutputTokens: number;
  directorNotes: string;
};

/**
 * A node in the branch tree (git-style). Children are branches forked from this
 * branch (parent_branch_id), ordered by creation. Powers the sidebar tree.
 */
export type BranchTreeNode = {
  id: string;
  name: string;
  parentBranchId: string | null;
  forkTurnId: string | null;
  headTurnId: string | null;
  isActive: boolean;
  createdAt: string;
  children: BranchTreeNode[];
};

/**
 * The authoritative slice of reconcilable chat state returned by every mutation
 * (read-your-writes). The client applies this directly to its store so the UI
 * updates instantly without a blind router.refresh().
 */
export type TurnSlicePatch = {
  headTurnId: string | null;
  messages: FantasiaUIMessage[];
  controlsByMessageId: Record<string, TranscriptControl>;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  branchTree: BranchTreeNode[];
  inspectorView: ContinuityInspectorView;
  settings: ThreadSettingsSlice;
};

export type MutationResult<T = TurnSlicePatch> =
  | { ok: true; slice: T }
  | { ok: false; error: string };

/** Result of a list mutation that carries no read-your-writes payload. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

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

// --- HCE World State Types ---

export const entityTypes = ['character', 'npc', 'creature', 'object', 'group'] as const;
export type EntityType = (typeof entityTypes)[number];

export const factTypes = ['knowledge', 'trait', 'goal', 'secret', 'ability', 'possession'] as const;
export type FactType = (typeof factTypes)[number];

export const relationshipTypes = ['social', 'romantic', 'familial', 'professional', 'adversarial', 'alliance', 'other'] as const;
export type RelationshipType = (typeof relationshipTypes)[number];

export const narrativeThreadStatuses = ['open', 'blocked', 'resolving', 'resolved'] as const;
export type NarrativeThreadStatus = (typeof narrativeThreadStatuses)[number];

export const transitionTypes = ['continuation', 'scene_transition', 'time_skip'] as const;
export type TransitionType = (typeof transitionTypes)[number];

export const timelineEventTypes = ['beat', 'reveal', 'betrayal', 'discovery', 'combat', 'scene_change', 'time_skip', 'relationship_shift', 'emotion_shift', 'spatial_move'] as const;
export type TimelineEventType = (typeof timelineEventTypes)[number];

export type WorldSnapshotRecord = {
  turn_id: string;
  thread_id: string;
  branch_id: string;
  based_on_turn_id: string | null;
  world_state: DurableMemorySnapshot;
  version: number;
  is_full_materialization: boolean;
  created_at: string;
  updated_at: string;
};

export type DurableMemorySnapshot = {
  metadata: {
    current_turn_id: string;
    narrative_timestamp: string;
    transition_type: TransitionType;
    version: number;
  };
  spatial_state: {
    current_location: {
      id: string;
      name: string;
      description: string;
      environmental_modifiers: string[];
    } | null;
    adjacent_locations: Array<{
      id: string;
      name: string;
    }>;
    known_locations: Array<{
      id: string;
      name: string;
      description: string;
      environmental_modifiers: string[];
    }>;
    edges: Array<{
      edge_id: string;
      from_location_id: string;
      to_location_id: string;
      is_bidirectional: boolean;
    }>;
    entity_placements: Array<{
      entity_id: string;
      entity_name: string;
      location_id: string;
      location_name: string;
      micro_position: string;
    }>;
  };
  entity_state: Array<{
    entity_id: string;
    canonical_name: string;
    entity_type: EntityType;
    aliases: string[];
    is_present: boolean;
    primary_emotion: string;
    emotion_intensity: number;
    emotion_catalyst: string;
    knowledge_boundary: Array<{ id: string; body: string }>;
    traits: Array<{ id: string; body: string }>;
    goals: Array<{ id: string; body: string }>;
    secrets: Array<{ id: string; body: string }>;
    abilities: Array<{ id: string; body: string }>;
    possessions: Array<{ id: string; body: string }>;
  }>;
  relational_state: Array<{
    relationship_id: string;
    source_entity_id: string;
    source_entity_name: string;
    target_entity_id: string;
    target_entity_name: string;
    relationship_type: RelationshipType;
    dynamic_status: string;
  }>;
  narrative_state: {
    story_summary: string;
    scene_summary: string;
    last_turn_beat: string;
    active_threads: Array<{
      thread_id: string;
      objective: string;
      status: NarrativeThreadStatus;
      dependencies: string[];
    }>;
    resolved_threads: string[];
  };
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

export type SnapshotResolution = {
  snapshot: DurableMemorySnapshot | null;
  isPending: boolean;
  isFailed: boolean;
  failureMessage: string | null;
};
