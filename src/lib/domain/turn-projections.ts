import type { ChatTurnRecord, FantasiaUIMessage, TranscriptControl } from "@/lib/types";
import { toTranscriptMessages, toModelContextMessages } from "@/lib/data/turns";

export const RECENT_SCENE_TURN_WINDOW = 4;

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
