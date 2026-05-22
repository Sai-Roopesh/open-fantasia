import { z } from "zod";
import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type { Json } from "@/lib/supabase/database.types";
import type { ChatTurnRecord, FantasiaUIMessage } from "@/lib/types";
import { turnRecordSchema } from "@/lib/validation";

const reservedTurnResultSchema = z.object({
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
  generation_status: z.enum(["reserved", "streaming", "committed", "failed"]),
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

const turnSelect = [
  "id",
  "thread_id",
  "branch_origin_id",
  "parent_turn_id",
  "user_input_text",
  "user_input_payload",
  "user_input_hidden",
  "starter_seed",
  "assistant_output_text",
  "assistant_output_payload",
  "generation_status",
  "reserved_by_user_id",
  "assistant_provider",
  "assistant_model",
  "assistant_connection_label",
  "finish_reason",
  "total_tokens",
  "prompt_tokens",
  "completion_tokens",
  "feedback_rating",
  "generation_started_at",
  "generation_finished_at",
  "failure_code",
  "failure_message",
  "created_at",
  "updated_at",
].join(", ");

export function normalizeTurn(value: unknown, label = "Turn") {
  return parseRow(value, turnRecordSchema, label) as ChatTurnRecord;
}

export function normalizeTurns(value: unknown, label = "Turns") {
  return parseRows(value, turnRecordSchema, label) as ChatTurnRecord[];
}

function createTextMessage(args: {
  id: string;
  role: "user" | "assistant";
  text: string;
  metadata?: FantasiaUIMessage["metadata"];
}) {
  return {
    id: args.id,
    role: args.role,
    parts: args.text
      ? [
          {
            type: "text" as const,
            text: args.text,
          },
        ]
      : [],
    metadata: args.metadata ?? {},
  } satisfies FantasiaUIMessage;
}

export function toTranscriptMessages(turn: ChatTurnRecord): FantasiaUIMessage[] {
  if (turn.generation_status !== "committed") {
    return [];
  }

  const messages: FantasiaUIMessage[] = [];
  if (!turn.user_input_hidden) {
    messages.push(
      createTextMessage({
        id: `${turn.id}:user`,
        role: "user",
        text: turn.user_input_text,
        metadata: {
          createdAt: turn.created_at,
          turnId: turn.id,
        },
      }),
    );
  }

  if (turn.assistant_output_text) {
    messages.push(
      createTextMessage({
        id: `${turn.id}:assistant`,
        role: "assistant",
        text: turn.assistant_output_text,
        metadata: {
          createdAt: turn.generation_finished_at ?? turn.updated_at,
          turnId: turn.id,
          provider: turn.assistant_provider ?? undefined,
          model: turn.assistant_model ?? undefined,
          connectionLabel: turn.assistant_connection_label ?? undefined,
          finishReason: turn.finish_reason ?? undefined,
          totalTokens: turn.total_tokens ?? undefined,
        },
      }),
    );
  }

  return messages;
}

export function toModelContextMessages(turn: ChatTurnRecord): FantasiaUIMessage[] {
  if (turn.generation_status !== "committed") {
    return [];
  }

  const messages = [
    createTextMessage({
      id: `${turn.id}:user`,
      role: "user",
      text: turn.user_input_text,
      metadata: {
        createdAt: turn.created_at,
        turnId: turn.id,
        hiddenFromTranscript: turn.user_input_hidden,
        starterSeed: turn.starter_seed,
      },
    }),
  ];

  if (turn.assistant_output_text) {
    messages.push(
      createTextMessage({
        id: `${turn.id}:assistant`,
        role: "assistant",
        text: turn.assistant_output_text,
        metadata: {
          createdAt: turn.generation_finished_at ?? turn.updated_at,
          turnId: turn.id,
          provider: turn.assistant_provider ?? undefined,
          model: turn.assistant_model ?? undefined,
          connectionLabel: turn.assistant_connection_label ?? undefined,
          finishReason: turn.finish_reason ?? undefined,
          totalTokens: turn.total_tokens ?? undefined,
        },
      }),
    );
  }

  return messages;
}

export async function listTurnsForThread(
  supabase: DatabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_turns")
    .select(turnSelect)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return normalizeTurns(data ?? [], "Thread turns");
}

export async function getTurn(
  supabase: DatabaseClient,
  threadId: string,
  turnId: string,
) {
  const { data, error } = await supabase
    .from("chat_turns")
    .select(turnSelect)
    .eq("thread_id", threadId)
    .eq("id", turnId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeTurn(data) : null;
}

export async function markTurnStreaming(
  supabase: DatabaseClient,
  threadId: string,
  turnId: string,
) {
  const { data, error } = await supabase
    .from("chat_turns")
    .update({
      generation_status: "streaming",
      updated_at: new Date().toISOString(),
    })
    .eq("thread_id", threadId)
    .eq("id", turnId)
    .select(turnSelect)
    .single();

  if (error) {
    throw error;
  }

  return normalizeTurn(data, "Streaming turn");
}

export async function beginTurn(
  supabase: DatabaseClient,
  args: {
    branchId: string;
    expectedHeadTurnId?: string | null;
    text: string;
    payload?: unknown[];
    parentTurnIdOverride?: string | null;
    forceParentOverride?: boolean;
    hiddenFromTranscript?: boolean;
    starterSeed?: boolean;
  },
) {
  const { data, error } = await supabase.rpc("begin_turn", {
    p_branch_id: args.branchId,
    p_expected_head_turn_id: args.expectedHeadTurnId ?? null,
    p_user_input_text: args.text,
    p_user_input_payload: ((args.payload ?? [
      {
        type: "text",
        text: args.text,
      },
    ]) as Json),
    p_parent_turn_id_override: args.parentTurnIdOverride ?? null,
    p_force_parent_override: args.forceParentOverride ?? false,
    p_user_input_hidden: args.hiddenFromTranscript ?? false,
    p_starter_seed: args.starterSeed ?? false,
  });

  if (error) {
    throw error;
  }

  return parseRow(data, reservedTurnResultSchema, "Reserved turn") as ChatTurnRecord;
}

export async function commitTurn(
  supabase: DatabaseClient,
  args: {
    branchId: string;
    turnId: string;
    assistantText: string;
    assistantPayload?: unknown[];
    provider: string | null;
    model: string | null;
    connectionLabel: string | null;
    finishReason: string | null;
    totalTokens: number | null;
    promptTokens: number | null;
    completionTokens: number | null;
  },
) {
  const { data, error } = await supabase.rpc("commit_turn", {
    p_branch_id: args.branchId,
    p_turn_id: args.turnId,
    p_assistant_output_text: args.assistantText,
    p_assistant_output_payload: ((args.assistantPayload ?? [
      {
        type: "text",
        text: args.assistantText,
      },
    ]) as Json),
    p_assistant_provider: args.provider,
    p_assistant_model: args.model,
    p_assistant_connection_label: args.connectionLabel,
    p_finish_reason: args.finishReason,
    p_total_tokens: args.totalTokens,
    p_prompt_tokens: args.promptTokens,
    p_completion_tokens: args.completionTokens,
  });

  if (error) {
    throw error;
  }

  return parseRow(data, turnRecordSchema, "Committed turn") as ChatTurnRecord;
}

export async function failTurn(
  supabase: DatabaseClient,
  args: {
    branchId: string;
    turnId: string;
    failureCode: string;
    failureMessage: string;
  },
) {
  const { data, error } = await supabase.rpc("fail_turn", {
    p_branch_id: args.branchId,
    p_turn_id: args.turnId,
    p_failure_code: args.failureCode,
    p_failure_message: args.failureMessage,
  });

  if (error) {
    throw error;
  }

  return parseRow(data, turnRecordSchema, "Failed turn") as ChatTurnRecord;
}

export async function rateTurn(
  supabase: DatabaseClient,
  threadId: string,
  turnId: string,
  rating: number,
) {
  const { data, error } = await supabase
    .from("chat_turns")
    .update({
      feedback_rating: rating,
      updated_at: new Date().toISOString(),
    })
    .eq("thread_id", threadId)
    .eq("id", turnId)
    .select(turnSelect)
    .single();

  if (error) {
    throw error;
  }

  return normalizeTurn(data, "Rated turn");
}
