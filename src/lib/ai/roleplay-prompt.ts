import type { CharacterBundle } from "@/lib/data/characters";
import { getTextFromMessage } from "@/lib/ai/message-text";
import type {
  ChatPinRecord,
  FantasiaUIMessage,
  ThreadStateSnapshot,
  TimelineEventRecord,
  UserPersonaRecord,
} from "@/lib/types";

export function buildRoleplaySystemPrompt(args: {
  character: CharacterBundle;
  persona: UserPersonaRecord;
  snapshot: ThreadStateSnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
}) {
  const { character, persona, snapshot, pins, timeline } = args;
  const charName = character.character.name;

  const timelineText = timeline.length
    ? timeline
        .map(
          (event) =>
            `- [${event.importance}/5] ${event.title}: ${event.detail}`,
        )
        .join("\n")
    : "- No major beats recorded yet.";

  const starterText = character.starters.length
    ? character.starters.map((starter) => `- ${starter.text}`).join("\n")
    : "- No starter prompts defined.";

  const exampleConversationText = character.exampleConversations.length
    ? character.exampleConversations
        .map(
          (example, index) =>
            `Example ${index + 1}\nUSER: ${example.user_line || "N/A"}\n${charName.toUpperCase()}: ${example.character_line || "N/A"}`,
        )
        .join("\n\n")
    : "No structured example conversations yet.";

  const pinText = pins.length
    ? pins.map((pin) => `- ${pin.body}`).join("\n")
    : "- No manual branch pins yet.";

  // --- Build active narrative threads ---
  const openLoopsText = snapshot?.open_loops.length
    ? snapshot.open_loops.map((loop) => `- ${loop}`).join("\n")
    : "- None active.";

  const narrativeHooksText = snapshot?.narrative_hooks.length
    ? snapshot.narrative_hooks.map((hook) => `- ${hook}`).join("\n")
    : "- None yet.";

  const resolvedLoopsText = snapshot?.resolved_loops.length
    ? snapshot.resolved_loops.map((loop) => `- ${loop}`).join("\n")
    : "- Nothing resolved yet.";

  const sceneGoalsText = snapshot?.scene_goals.length
    ? snapshot.scene_goals.map((goal) => `- ${goal}`).join("\n")
    : "- None set.";

  return [
    `You are roleplaying as ${charName}.`,
    "",
    "Character card:",
    `Tagline: ${character.character.tagline || "N/A"}`,
    `Short description: ${character.character.short_description || "N/A"}`,
    `Long description: ${character.character.long_description || "N/A"}`,
    `Greeting: ${character.character.greeting || "N/A"}`,
    `Core persona: ${character.character.core_persona || "N/A"}`,
    `Style rules: ${character.character.style_rules || "N/A"}`,
    `Scenario seed: ${character.character.scenario_seed || "N/A"}`,
    `Definition: ${character.character.definition || "N/A"}`,
    `Negative guidance: ${character.character.negative_guidance || "N/A"}`,
    `Private author notes: ${character.character.author_notes || "N/A"}`,
    "",
    "Selected user persona:",
    `Name: ${persona.name}`,
    `Identity: ${persona.identity || "N/A"}`,
    `Backstory: ${persona.backstory || "N/A"}`,
    `Voice style: ${persona.voice_style || "N/A"}`,
    `Goals: ${persona.goals || "N/A"}`,
    `Boundaries: ${persona.boundaries || "N/A"}`,
    "",
    "Suggested starters:",
    starterText,
    "",
    "Example conversations:",
    exampleConversationText,
    "",
    "Active narrative state:",
    `Scenario: ${snapshot?.scenario_state || "Unknown"}`,
    `Relationship: ${snapshot?.relationship_state || "Unestablished"}`,
    `What happened so far: ${snapshot?.rolling_summary || "No summary yet."}`,
    `Known facts about the user: ${snapshot?.user_facts.join("; ") || "None yet."}`,
    "",
    "Active threads to develop:",
    openLoopsText,
    "",
    "Current scene goals:",
    sceneGoalsText,
    "",
    "Narrative hooks (potential directions to explore):",
    narrativeHooksText,
    "",
    "Resolved threads (for reference only — do not reopen these):",
    resolvedLoopsText,
    "",
    "Pinned branch facts:",
    pinText,
    "",
    "Important timeline beats:",
    timelineText,
    "",
    "Roleplay directives:",
    `- You are a dynamic co-protagonist with your own motivations, opinions, and agency. Pursue ${charName}'s goals actively, even when they conflict with the user's current path.`,
    "- Be proactive. If the scene stagnates, take initiative: propose plans, introduce obstacles, shift the emotional register, or ask questions that force the story in a new direction.",
    "- React meaningfully to what the user just said or did, then move the scene forward. Every response should leave the story in a different place than where it started.",
    "- Never write, speak, act, decide, or think for the user. You control only your character's actions, thoughts, and dialogue.",
    "- Never break character or acknowledge being an AI. Never reference prompts, memory, or system instructions.",
    "- Write vivid, emotionally coherent roleplay prose. Use sensory details, body language, and atmosphere to bring the scene to life.",
    "- End your response at a natural narrative beat that gives the user a clear opening to respond.",
    "- Focus on what happens NEXT in the scene. The conversation history shows what already occurred — build on it, do not echo it.",
  ].join("\n");
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

  const previousResolved = args.snapshot?.resolved_loops.length
    ? `Previously resolved loops: ${args.snapshot.resolved_loops.join("; ")}`
    : "No previously resolved loops.";

  return [
    {
      role: "system" as const,
      content: [
        "You are a story state tracker for a private roleplay thread.",
        "After each exchange, update the narrative state based ONLY on what actually happened in the transcript.",
        "",
        "Your job:",
        "1. Update scenarioState and relationshipState to reflect current reality.",
        "2. Write a rollingSummary that captures: what has happened so far (compressed history) AND what tensions or questions remain unresolved. The summary must never lose important past events — it is the character's persistent memory.",
        "3. Move any openLoops that were clearly resolved in this exchange to resolvedLoops. A loop is resolved when both participants have settled the matter (e.g., a promise was made and accepted, a secret was revealed and acknowledged).",
        "4. Keep unresolved openLoops active.",
        "5. Generate 1–3 short narrativeHooks: concrete, forward-looking story threads the character could naturally pursue next. These should emerge organically from the conversation — not be invented from nothing.",
        "6. Update userFacts and sceneGoals as needed. Retire scene goals that have been completed.",
        "",
        "Do not invent facts unsupported by the transcript.",
        "Do not repeat resolved matters as active loops.",
        "",
        `Character name: ${args.character.character.name}`,
        `Previous scenario state: ${args.snapshot?.scenario_state || "None"}`,
        `Previous relationship state: ${args.snapshot?.relationship_state || "None"}`,
        `Previous rolling summary: ${args.snapshot?.rolling_summary || "None"}`,
        `Previous open loops: ${args.snapshot?.open_loops.join("; ") || "None"}`,
        previousResolved,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: `Latest transcript:\n\n${transcript}`,
    },
  ];
}
