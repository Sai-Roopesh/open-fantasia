import type { CharacterBundle } from "@/lib/data/characters";
import type {
  ChatBranchRecord,
  ChatPinRecord,
  ChatTurnRecord,
  ThreadRecord,
  TimelineEventRecord,
} from "@/lib/types";
import { buildTurnPath } from "./turn-projections";

export type ThreadAssembly = {
  thread: ThreadRecord;
  branches: ChatBranchRecord[];
  activeBranch: ChatBranchRecord;
  turns: ChatTurnRecord[];
  latestTurn: ChatTurnRecord | null;
  characterBundle: CharacterBundle | null;
  timeline: TimelineEventRecord[];
  pins: ChatPinRecord[];
};

export function buildThreadAssembly(rawData: {
  thread: ThreadRecord;
  branches: ChatBranchRecord[];
  turns: ChatTurnRecord[];
  characterBundle: CharacterBundle | null;
  timelineRows: TimelineEventRecord[];
  pinRows: ChatPinRecord[];
}): ThreadAssembly {
  const { thread, branches, turns, characterBundle, timelineRows, pinRows } = rawData;

  const activeBranch = branches.find((b) => b.is_active) ?? branches[0] ?? null;
  if (!activeBranch) {
    throw new Error("Thread has no active branch.");
  }

  const reachableTurns = buildTurnPath(turns, activeBranch.head_turn_id);
  const reachableTurnIds = new Set(reachableTurns.map((t) => t.id));

  const timeline = timelineRows.filter(
    (event) => !event.turn_id || reachableTurnIds.has(event.turn_id),
  );
  const pins = pinRows.filter(
    (pin) => !pin.turn_id || reachableTurnIds.has(pin.turn_id),
  );

  return {
    thread,
    branches,
    activeBranch,
    turns: reachableTurns,
    latestTurn: reachableTurns.at(-1) ?? null,
    characterBundle,
    timeline,
    pins,
  };
}
