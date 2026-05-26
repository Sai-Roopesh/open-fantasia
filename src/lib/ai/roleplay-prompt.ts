import type { CharacterBundle } from "@/lib/data/characters";
import type {
  ChatPinRecord,
  DurableMemorySnapshot,
  TimelineEventRecord,
  UserPersonaRecord,
} from "@/lib/types";

function compactLabeledLines(items: Array<[label: string, value: string | null | undefined]>) {
  return items.flatMap(([label, value]) => {
    const trimmed = value?.trim();
    return trimmed ? [`${label}: ${trimmed}`] : [];
  });
}

function formatSection(tag: string, lines: string[]) {
  return [`<${tag}>`, ...lines, `</${tag}>`].join("\n");
}

export function buildRoleplaySystemPrompt(args: {
  character: CharacterBundle;
  persona: UserPersonaRecord;
  snapshot: DurableMemorySnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
}) {
  const { character, persona, snapshot, pins, timeline } = args;
  const charName = character.character.name;
  const promptTimeline = timeline;

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
  );

  sections.push(
    formatSection("core_directives", [
      "- You are a high-fidelity simulation engine executing a narrative reality.",
      "- You are bound absolutely by the constraints in <durable_state>.",
      "- COGNITIVE BOUNDARY: Under no circumstances may an entity act upon, reference, or hint at information absent from their specific knowledge_boundary in the state JSON.",
      "- AFFECTIVE OVERRIDE: Do not allow genre tropes to override the emotional parameters in the state. The JSON state is absolute truth.",
      "- SPATIAL ENFORCEMENT: Characters can only interact with entities at their current location. Characters can only move to adjacent locations.",
      "- Treat every field in <durable_state> as hard programmatic constraints, not fluid prose suggestions.",
    ]),
  );

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
      "- COMPLETION RULE: Always finish your response with a complete sentence and a natural stopping point. If you sense you are running long, wrap up the current beat gracefully rather than starting a new one. Never stop mid-sentence, mid-paragraph, or mid-thought.",
    ]),
  );

  // Dynamic sections placed last to maximize prompt prefix cache hits.
  if (snapshot) {
    sections.push(
      formatSection("durable_state", [
        JSON.stringify(snapshot, null, 2),
      ]),
    );
  } else {
    sections.push(
      formatSection("durable_state", [
        "No world state has been materialized yet. This is the beginning of the story.",
      ]),
    );
  }

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

  return sections.join("\n\n");
}
