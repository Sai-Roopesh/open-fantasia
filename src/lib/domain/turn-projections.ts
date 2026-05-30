import type { ChatTurnRecord, FantasiaUIMessage, TranscriptControl } from "@/lib/types";
import { createTextMessage } from "@/lib/domain/message-factory";

export const RECENT_SCENE_TURN_WINDOW = 4;

/**
 * Converts a committed turn into UI messages for the **displayed transcript**.
 * Turns with `user_input_hidden === true` omit the user message entirely — the
 * user never sees hidden prompts (starter seeds, regeneration guidance) in the
 * chat history.
 *
 * For the model's context window (where hidden turns must be included), use
 * {@link toModelContextMessages} instead.
 */
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

/**
 * Converts a committed turn into UI messages for the **model context window**.
 * Unlike {@link toTranscriptMessages}, this always includes the user input —
 * even when `user_input_hidden` is true — because the model needs the full
 * conversational context. The `hiddenFromTranscript` and `starterSeed`
 * metadata flags let callers distinguish hidden prompts if needed.
 */
export function toModelContextMessages(turn: ChatTurnRecord): FantasiaUIMessage[] {
  if (turn.generation_status !== "committed") {
    return [];
  }

  const messages: FantasiaUIMessage[] = [
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

export function buildTurnPath(
  turns: ChatTurnRecord[],
  headTurnId: string | null,
): ChatTurnRecord[] {
  if (!headTurnId) {
    return [];
  }

  const turnsById = new Map(turns.map((turn) => [turn.id, turn]));
  const path: ChatTurnRecord[] = [];
  const seen = new Set<string>();
  let pointer: string | null = headTurnId;

  while (pointer) {
    if (seen.has(pointer)) {
      throw new Error("Detected a turn cycle while building the branch path.");
    }
    if (path.length >= 5000) {
      throw new Error("Branch history exceeded the supported depth limit.");
    }

    const turn = turnsById.get(pointer);
    if (!turn) {
      break;
    }

    seen.add(pointer);
    path.push(turn);
    pointer = turn.parent_turn_id;
  }

  return path.reverse();
}

export function buildCanonicalMessages(turns: ChatTurnRecord[]): FantasiaUIMessage[] {
  return turns.flatMap((turn) => toTranscriptMessages(turn));
}

/**
 * Renders the visible transcript of a branch path as plain text for copy/export.
 * Hidden turns (starter seeds, guidance) are omitted, matching the displayed
 * transcript. Each turn becomes a `User:` / `<character>:` exchange.
 */
export function buildPlainTextTranscript(
  turns: ChatTurnRecord[],
  characterName: string,
): string {
  const speaker = characterName.trim() || "Character";
  const blocks: string[] = [];

  for (const turn of turns) {
    if (turn.generation_status !== "committed") continue;
    if (!turn.user_input_hidden && turn.user_input_text.trim()) {
      blocks.push(`User: ${turn.user_input_text.trim()}`);
    }
    if (turn.assistant_output_text?.trim()) {
      blocks.push(`${speaker}: ${turn.assistant_output_text.trim()}`);
    }
  }

  return blocks.join("\n\n");
}

export function buildRecentSceneMessages(
  turns: ChatTurnRecord[],
  turnWindow = RECENT_SCENE_TURN_WINDOW,
): FantasiaUIMessage[] {
  return turns
    .filter((turn) => turn.generation_status === "committed")
    .slice(-turnWindow)
    .flatMap((turn) => toModelContextMessages(turn));
}

export function buildControlsByMessageId(
  turns: ChatTurnRecord[],
): Record<string, TranscriptControl> {
  const latestTurnId = turns.at(-1)?.id ?? null;
  const controlsByMessageId: Record<string, TranscriptControl> = {};

  for (const turn of turns) {
    if (turn.generation_status !== "committed") {
      continue;
    }

    controlsByMessageId[`${turn.id}:user`] = {
      turnId: turn.id,
      branchId: turn.branch_origin_id,
      canEdit: latestTurnId === turn.id,
      canRegenerate: false,
      canBranch: true,
      canRewind: true,
      canPin: true,
      canRate: false,
      feedbackRating: turn.feedback_rating,
    };

    controlsByMessageId[`${turn.id}:assistant`] = {
      turnId: turn.id,
      branchId: turn.branch_origin_id,
      canEdit: latestTurnId === turn.id,
      canRegenerate: latestTurnId === turn.id,
      canBranch: false,
      canRewind: false,
      canPin: true,
      canRate: true,
      feedbackRating: turn.feedback_rating,
    };
  }

  return controlsByMessageId;
}
