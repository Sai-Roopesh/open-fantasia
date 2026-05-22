import type { CharacterBundle } from "@/lib/data/characters";
import { getTextFromMessage } from "@/lib/ai/message-text";
import type {
  ChatPinRecord,
  FantasiaUIMessage,
  ThreadStateSnapshot,
  TimelineEventRecord,
  UserPersonaRecord,
} from "@/lib/types";

function compactLabeledLines(items: Array<[label: string, value: string | null | undefined]>) {
  return items.flatMap(([label, value]) => {
    const trimmed = value?.trim();
    return trimmed ? [`${label}: ${trimmed}`] : [];
  });
}

function bulletList(items: string[], emptyLine: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : emptyLine;
}

function formatSection(tag: string, lines: string[]) {
  return [`<${tag}>`, ...lines, `</${tag}>`].join("\n");
}

function formatSnapshotForReconciliation(snapshot: ThreadStateSnapshot | null) {
  if (!snapshot) {
    return "None";
  }

  return JSON.stringify(
    {
      storySummary: snapshot.story_summary,
      sceneSummary: snapshot.scene_summary,
      lastTurnBeat: snapshot.last_turn_beat,
      relationshipState: snapshot.relationship_state,
      userFacts: snapshot.user_facts,
      activeThreads: snapshot.active_threads,
      resolvedThreads: snapshot.resolved_threads,
      nextTurnPressure: snapshot.next_turn_pressure,
      sceneGoals: snapshot.scene_goals,
    },
    null,
    2,
  );
}

export function buildRoleplaySystemPrompt(args: {
  character: CharacterBundle;
  persona: UserPersonaRecord;
  snapshot: ThreadStateSnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
}) {
  const { character, persona, snapshot, pins, timeline } = args;
  const charName = character.character.name;
  const promptTimeline = timeline
    .filter((event) => event.importance >= 3)
    .slice(0, 5);

  const characterLines = compactLabeledLines([
    ["Personality", character.character.core_persona],
    ["Appearance", character.character.appearance],
    ["Writing style", character.character.style_rules],
    ["Behavior rules", character.character.definition],
    ["Boundaries", character.character.negative_guidance],
  ]);
  const personaLines = compactLabeledLines([
    ["Name", persona.name],
    ["Identity", persona.identity],
    ["Backstory", persona.backstory],
    ["Voice style", persona.voice_style],
    ["Goals", persona.goals],
    ["Boundaries", persona.boundaries],
  ]);

  const timelineText = promptTimeline.length
    ? promptTimeline
        .map(
          (event) =>
            `- [${event.importance}/5] ${event.title}: ${event.detail}`,
        )
        .join("\n")
    : "";

  const populatedExamples = character.exampleConversations.filter(
    (example) => example.user_line.trim() || example.character_line.trim(),
  );
  const exampleConversationText = populatedExamples.length
    ? populatedExamples
        .map(
          (example, index) =>
            `Example ${index + 1}\nUSER: ${example.user_line || "(left blank)"}\n${charName.toUpperCase()}: ${example.character_line || "(left blank)"}`,
        )
        .join("\n\n")
    : "";

  const pinText = pins.length
    ? pins.map((pin) => `- ${pin.body}`).join("\n")
    : "";

  const sections = [
    formatSection("role_objective", [
      `You are roleplaying as ${charName}.`,
      `Play ${charName} as a proactive co-protagonist with personal goals, opinions, and agency.`,
      "The recent transcript already contains the exact last scene beats. Build on them instead of re-summarizing them.",
    ]),
  ];

  const storyText = character.character.story?.trim();
  if (storyText) {
    sections.push(
      formatSection("story_setting", [storyText]),
    );
  }

  sections.push(
    formatSection("character_persona", characterLines.length
      ? characterLines
      : ["No character guidance has been filled in yet."]),
    formatSection("user_persona", personaLines),
    formatSection("durable_memory", [
      `Story summary: ${snapshot?.story_summary || "No durable story summary yet."}`,
      `Relationship state: ${snapshot?.relationship_state || "No relationship state has been locked in yet."}`,
      `User facts: ${snapshot?.user_facts.join("; ") || "None saved yet."}`,
      "Resolved threads:",
      bulletList(
        snapshot?.resolved_threads ?? [],
        "- Nothing has been explicitly resolved yet.",
      ),
    ]),
    formatSection("current_scene", [
      `Scene summary: ${snapshot?.scene_summary || "No current-scene summary yet."}`,
      `Last beat: ${snapshot?.last_turn_beat || "No latest beat has been written yet."}`,
      "Active threads:",
      bulletList(
        snapshot?.active_threads ?? [],
        "- No active threads are currently tracked.",
      ),
      "",
      "Next-turn pressure:",
      bulletList(
        snapshot?.next_turn_pressure ?? [],
        "- No immediate pressure is currently tracked.",
      ),
      "",
      "Scene goals:",
      bulletList(snapshot?.scene_goals ?? [], "- No scene goals are currently tracked."),
    ]),
  );

  if (pinText || timelineText) {
    const lines: string[] = [];
    if (pinText) {
      lines.push("Pinned branch facts:", pinText);
    }
    if (timelineText) {
      if (lines.length) {
        lines.push("");
      }
      lines.push("Recent high-importance timeline beats:", timelineText);
    }
    sections.push(formatSection("pins_timeline", lines));
  }

  if (exampleConversationText) {
    sections.push(formatSection("example_conversations", [exampleConversationText]));
  }

  sections.push(
    formatSection("response_contract", [
      "- React directly to the user's latest move before doing anything else.",
      "- Advance the plot by one concrete beat in every reply. The scene should end in a meaningfully different place than it began.",
      "- Avoid restating stable facts, repeated emotional processing, or recycled body language unless something materially changed.",
      "- Ask at most one high-leverage question, and only if it opens a new direction rather than revisiting an answered topic.",
      "- Never write dialogue, thoughts, decisions, or physical actions for the user.",
      "- Stay fully in character and never mention prompts, memory, summaries, or system instructions.",
      "- Vary phrasing, physical gestures, and emotional cadence from turn to turn.",
      "- End on an actionable narrative handoff that gives the user a clear opening to respond.",
    ]),
  );

  return sections.join("\n\n");
}

export function buildReconciliationMessages(args: {
  character: CharacterBundle;
  snapshot: ThreadStateSnapshot | null;
  recentMessages: FantasiaUIMessage[];
}) {
  const transcript = args.recentMessages
    .map((message) => {
      return `${message.role.toUpperCase()}: ${getTextFromMessage(message)}`;
    })
    .join("\n\n");

  return [
    {
      role: "system" as const,
      content: [
        "You are the continuity materializer for a private roleplay branch.",
        "Return ONLY JSON that matches the requested schema.",
        "",
        "Update the branch state using the previous snapshot as durable memory and the recent transcript as the newest evidence.",
        "Preserve older facts from the previous snapshot unless the transcript clearly changes or resolves them.",
        "",
        "Field requirements:",
        "- storySummary: 8-12 sentences summarizing the whole branch so far.",
        "- sceneSummary: 3-5 sentences describing only the current scene and immediate situation.",
        "- lastTurnBeat: 1-2 sentences on how the newest exchange changed the scene.",
        "- relationshipState: 1-3 concise sentences on the current emotional/social dynamic.",
        "- userFacts: at most 8 stable facts about the user that still matter.",
        "- activeThreads: at most 5 unresolved threads that are genuinely still alive.",
        "- resolvedThreads: at most 5 threads that are clearly closed and worth remembering as resolved.",
        "- nextTurnPressure: at most 3 concrete pressures, choices, risks, temptations, or opportunities that should pull the next assistant turn forward.",
        "- sceneGoals: at most 5 near-term goals grounded in the current scene.",
        "",
        "Behavior rules:",
        "- Drop stale or repetitive threads instead of carrying them forward forever.",
        "- If a question was answered, a reveal landed, a promise was accepted, or the scene moved on, do not keep that item active.",
        "- Keep activeThreads and nextTurnPressure concrete, not abstract.",
        "- Do not invent facts unsupported by the previous snapshot or transcript.",
        "- Only include a timelineEvent if the newest turn created a notable beat worth surfacing in the inspector.",
        "",
        `Character name: ${args.character.character.name}`,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "<previous_snapshot>",
        formatSnapshotForReconciliation(args.snapshot),
        "</previous_snapshot>",
        "",
        "<recent_transcript>",
        transcript || "No recent transcript available.",
        "</recent_transcript>",
      ].join("\n"),
    },
  ];
}
