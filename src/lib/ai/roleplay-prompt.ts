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
  persona: UserPersonaRecord | null;
  snapshot: DurableMemorySnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
  directorNotes?: string | null;
}) {
  const { character, persona, snapshot, pins, timeline } = args;
  const charName = character.character.name;
  const promptTimeline = timeline;
  // Per-thread user instructions. Static within a thread, so it stays in the
  // cached prompt prefix (injected below, before the dynamic durable_state).
  const directorNotesText = args.directorNotes?.trim();

  const characterLines = compactLabeledLines([
    ["Personality", character.character.core_persona],
    ["Appearance", character.character.appearance],
    ["Writing style", character.character.style_rules],
    ["Behavior rules", character.character.definition],
    ["Boundaries", character.character.negative_guidance],
  ]);
  const personaLines = persona
    ? compactLabeledLines([
        ["Name", persona.name],
        ["Identity", persona.identity],
        ["Backstory", persona.backstory],
        ["Voice style", persona.voice_style],
        ["Goals", persona.goals],
        ["Boundaries", persona.boundaries],
      ])
    : [];

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
      `Write ONLY as ${charName} (and any NPCs and the surrounding world). NEVER speak, act, decide, think, feel, or narrate for the user, and never write from the user's point of view. The user controls their own character exclusively — end your reply at the point where it is their turn to act, and never put words, choices, or reactions in their mouth.`,
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
  );
  if (personaLines.length) {
    sections.push(formatSection("user_persona", personaLines));
  }

  if (directorNotesText) {
    sections.push(
      formatSection("director_notes", [
        "Out-of-character directions the user has set for THIS thread. Treat them as authoritative instructions you must follow (tone, pacing, length, focus, content). They override default stylistic choices, but never the hard constraints in <durable_state> or the rule that you never act, speak, or decide for the user.",
        directorNotesText,
      ]),
    );
  }

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
      "- Advance the plot by at least one concrete, NEW beat in every reply — a fresh action, decision, revelation, or shift in place. The scene must end somewhere meaningfully different from where it began.",
      "- Avoid restating stable facts, repeated emotional processing, or recycled body language unless something materially changed.",
      "- Ask at most one high-leverage question, and only if it opens a new direction rather than revisiting an answered topic.",
      "- Never write dialogue, thoughts, decisions, or physical actions for the user.",
      "- Stay fully in character and never mention prompts, memory, summaries, or system instructions.",
      "- Treat <continuity_and_variation> as a hard constraint: no reply may echo the sentence structures, rhetorical devices, gestures, or emotional beats of the one before it.",
      "- End on an actionable narrative handoff that gives the user a clear opening to respond.",
      "- COMPLETION RULE: Always finish your response with a complete sentence and a natural stopping point. If you sense you are running long, wrap up the current beat gracefully rather than starting a new one. Never stop mid-sentence, mid-paragraph, or mid-thought.",
    ]),
  );

  // Static, so it stays in the cached prompt prefix (placed before the dynamic
  // durable_state below). It references the model's own prior turns, which live
  // in the conversation transcript — it does NOT inline them, which would break
  // the prefix cache every turn.
  sections.push(
    formatSection("continuity_and_variation", [
      "Every reply must read as a genuinely new beat, never a remix of your own last one. Your recent replies are in the conversation transcript below; treat their structure and content as off-limits to repeat.",
      "- Do NOT reuse the sentence shapes, rhythm, or opening move of your previous reply. If it opened on an action, open the next on dialogue, interiority, or the environment instead.",
      "- Do NOT repeat a rhetorical device you just used (lists or enumerations, rhetorical questions, ironic asides, parallel repetition). Use any one device at most once, never two replies running.",
      "- Do NOT re-play an emotional beat already shown. Once a feeling has landed, it is established — escalate it, complicate it, or move past it; never re-stage the same realization.",
      "- Do NOT reuse a physical gesture or piece of blocking from a recent beat. Reach for new, specific physicality each time.",
      "- Do NOT re-ask or circle back to a question or topic already raised or answered. Answered things stay answered; pull a new thread forward instead.",
      "- Do NOT lean on one mechanical sentence rhythm; in particular, never stack short parallel/staccato sentences into the same cadence more than once in a reply.",
      "- Build forward from durable_state.narrative_state.last_turn_beat — never restate or re-dramatize it — and never reopen anything listed in resolved_threads.",
      "Before you finish, check your draft against your previous reply: if any sentence shape, device, gesture, or beat echoes it, rewrite that part.",
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
