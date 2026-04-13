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

export function buildRoleplaySystemPrompt(args: {
  character: CharacterBundle;
  persona: UserPersonaRecord;
  snapshot: ThreadStateSnapshot | null;
  pins: ChatPinRecord[];
  timeline: TimelineEventRecord[];
}) {
  const { character, persona, snapshot, pins, timeline } = args;
  const charName = character.character.name;

  const characterLines = compactLabeledLines([
    ["Personality", character.character.core_persona],
    ["Opening line", character.character.greeting],
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

  const timelineText = timeline.length
    ? timeline
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

  // --- Build active narrative threads ---
  const openLoopsText = bulletList(snapshot?.open_loops ?? [], "- None active.");

  const narrativeHooksText = bulletList(snapshot?.narrative_hooks ?? [], "- None yet.");

  const resolvedLoopsText = bulletList(
    snapshot?.resolved_loops ?? [],
    "- Nothing resolved yet.",
  );

  const sceneGoalsText = bulletList(snapshot?.scene_goals ?? [], "- None set.");

  const sections: string[] = [
    `You are roleplaying as ${charName}.`,
  ];

  // ── STORY AND SETTING ──
  const storyText = character.character.story?.trim();
  if (storyText) {
    sections.push(
      "",
      "── STORY AND SETTING ──",
      storyText,
    );
  }

  // ── CHARACTER ──
  sections.push(
    "",
    "── CHARACTER ──",
    ...(characterLines.length ? characterLines : ["No character guidance has been filled in yet."]),
  );

  // ── USER PERSONA ──
  sections.push(
    "",
    "── USER PERSONA ──",
    ...personaLines,
  );

  // ── NARRATIVE STATE ──
  sections.push(
    "",
    "── NARRATIVE STATE ──",
    `Current scenario: ${snapshot?.scenario_state || "Unknown"}`,
    `Relationship: ${snapshot?.relationship_state || "Unestablished"}`,
    `What happened so far: ${snapshot?.rolling_summary || "No summary yet."}`,
    `Known facts about the user: ${snapshot?.user_facts.join("; ") || "None yet."}`,
  );

  // ── ACTIVE THREADS ──
  sections.push(
    "",
    "── ACTIVE THREADS ──",
    "Unresolved story threads (do not re-raise if already addressed):",
    openLoopsText,
    "",
    "Scene goals (retire naturally once achieved):",
    sceneGoalsText,
    "",
    "Narrative hooks (optional future directions — only pursue if natural):",
    narrativeHooksText,
    "",
    "Resolved threads (reference only — do not reopen):",
    resolvedLoopsText,
  );

  // ── PINS & TIMELINE ──
  if (pinText || timelineText) {
    sections.push("", "── PINS & TIMELINE ──");
    if (pinText) {
      sections.push("Pinned branch facts:", pinText);
    }
    if (timelineText) {
      sections.push("Important timeline beats:", timelineText);
    }
  }

  // ── EXAMPLES ──
  if (exampleConversationText) {
    sections.push(
      "",
      "── EXAMPLE CONVERSATIONS ──",
      exampleConversationText,
    );
  }

  // ── DIRECTIVES ──
  sections.push(
    "",
    "── DIRECTIVES ──",
    `- You are a dynamic co-protagonist with your own motivations, opinions, and agency. Pursue ${charName}'s goals actively, even when they conflict with the user's current path.`,
    "- Be proactive. If the scene stagnates, take initiative: propose plans, introduce obstacles, shift the emotional register, or ask questions that force the story in a new direction.",
    "- React meaningfully to what the user just said or did, then move the scene forward. Every response should leave the story in a different place than where it started.",
    "- Never write, speak, act, decide, or think for the user. You control only your character's actions, thoughts, and dialogue.",
    "- Never break character or acknowledge being an AI. Never reference prompts, memory, or system instructions.",
    "- Write vivid, emotionally coherent roleplay prose. Use sensory details, body language, and atmosphere to bring the scene to life.",
    "- End your response at a natural narrative beat that gives the user a clear opening to respond.",
    "- Focus on what happens NEXT in the scene. The conversation history shows what already occurred — build on it, do not echo it.",
    "",
    "── ANTI-REPETITION ──",
    "- NEVER re-ask a question the user has already answered. If the user revealed a secret, confirmed a fact, or made a promise, ACCEPT it and move on.",
    "- If a story thread listed under 'Unresolved story threads' was clearly addressed in the last few messages, treat it as resolved. Do not loop back to it.",
    "- Vary your emotional register. If the last 2-3 responses shared the same tone (e.g., intense questioning), shift to something different (relief, humor, planning, vulnerability).",
    "- Track what your character has already said and done. Do not repeat the same physical gestures, expressions, or dialogue patterns across consecutive responses.",
    "- When the user gives you new information, your response must show genuine progression: new understanding, changed behavior, a new question about a DIFFERENT topic, or a shift in the scene's direction.",
  );

  return sections.join("\n");
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
        "3. Move openLoops to resolvedLoops aggressively. A loop is resolved when ANY of these are true:",
        "   - The user answered a question or revealed information the character asked about",
        "   - A promise was made and accepted",
        "   - A secret was revealed (regardless of whether the character fully processed it)",
        "   - The topic was discussed and the conversation moved on to something else",
        "   - The same loop has appeared in openLoops for 2+ consecutive turns without meaningful change",
        "4. Keep only genuinely unaddressed openLoops active. If in doubt, resolve it.",
        "5. Generate 1–3 short narrativeHooks: concrete, forward-looking story threads the character could naturally pursue next. These should emerge organically from the conversation — not be invented from nothing. Do NOT generate hooks that repeat recently resolved loops.",
        "6. Update userFacts and sceneGoals as needed. Retire scene goals that have been completed or are no longer relevant.",
        "",
        "Critical: If the character has been asking the same question or pressing the same topic across multiple turns, that loop MUST be moved to resolvedLoops immediately. Narrative stagnation is the worst outcome.",
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
