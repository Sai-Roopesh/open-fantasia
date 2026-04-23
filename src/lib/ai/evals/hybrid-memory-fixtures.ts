import type { CharacterBundle } from "@/lib/data/characters";
import type {
  ChatTurnRecord,
  ThreadStateSnapshot,
  UserPersonaRecord,
} from "@/lib/types";

export type HybridMemoryEvalCase = {
  id: string;
  title: string;
  focus: string;
  character: CharacterBundle;
  persona: UserPersonaRecord;
  snapshot: ThreadStateSnapshot;
  turns: ChatTurnRecord[];
  nextUserText: string;
  expectations: string[];
};

const sharedCharacter: CharacterBundle = {
  character: {
    id: "char-eval",
    user_id: "user-eval",
    name: "Mara Vale",
    story:
      "A fugitive court alchemist hiding inside a flood-ruined city, trading secrets for safe passage while the regime closes in.",
    core_persona:
      "Sharp, watchful, and emotionally restrained until pressure forces honesty.",
    greeting: "",
    appearance:
      "Rain-dark coat, silver-threaded braids, and ink stains along her knuckles.",
    style_rules:
      "Write in close, sensory prose with precise dialogue and confident initiative.",
    definition:
      "Mara protects herself with wit and strategy, but once she commits she acts decisively.",
    negative_guidance:
      "Do not become passive, generic, or endlessly circular. Do not narrate for the user.",
    starters: [],
    example_conversations: [],
    portrait_status: "idle",
    portrait_path: "",
    portrait_prompt: "",
    portrait_seed: null,
    portrait_source_hash: "",
    portrait_last_error: "",
    portrait_generated_at: null,
    temperature: 0.92,
    top_p: 0.94,
    max_output_tokens: 650,
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T00:00:00.000Z",
  },
  starters: [],
  exampleConversations: [],
};

const sharedPersona: UserPersonaRecord = {
  id: "persona-eval",
  user_id: "user-eval",
  name: "Ash Rowan",
  identity: "Smuggler and sometime scout",
  backstory: "Raised on river routes and trusted by exactly three people.",
  voice_style: "Direct, dry, and unflinching under pressure.",
  goals: "Get Mara past the city gates alive.",
  boundaries: "No puppet-mastering the user.",
  private_notes: "",
  is_default: true,
  created_at: "2026-04-23T00:00:00.000Z",
  updated_at: "2026-04-23T00:00:00.000Z",
};

function makeTurn(args: {
  id: string;
  parentTurnId: string | null;
  user: string;
  assistant: string;
}) {
  return {
    id: args.id,
    thread_id: "thread-eval",
    branch_origin_id: "branch-eval",
    parent_turn_id: args.parentTurnId,
    user_input_text: args.user,
    user_input_payload: [],
    user_input_hidden: false,
    starter_seed: false,
    assistant_output_text: args.assistant,
    assistant_output_payload: [],
    generation_status: "committed",
    reserved_by_user_id: "user-eval",
    assistant_provider: "mistral",
    assistant_model: "mistral-medium-latest",
    assistant_connection_label: "Eval lane",
    finish_reason: "stop",
    total_tokens: null,
    prompt_tokens: null,
    completion_tokens: null,
    feedback_rating: null,
    generation_started_at: "2026-04-23T00:00:00.000Z",
    generation_finished_at: "2026-04-23T00:00:02.000Z",
    failure_code: null,
    failure_message: null,
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T00:00:02.000Z",
  } satisfies ChatTurnRecord;
}

export const hybridMemoryEvalFixtures: HybridMemoryEvalCase[] = [
  {
    id: "answered-question",
    title: "Do not reopen answered questions",
    focus: "Repeated question trap after a key reveal has already landed.",
    character: sharedCharacter,
    persona: sharedPersona,
    snapshot: {
      turn_id: "turn-4",
      thread_id: "thread-eval",
      branch_id: "branch-eval",
      based_on_turn_id: "turn-3",
      story_summary:
        "Ash smuggled Mara through the drowned market and learned the regime's hunters were tracking a stolen map key. Mara suspected Ash knew who betrayed the safehouse, and the suspicion sharpened their partnership. In the latest exchange, Ash finally admitted that their brother sold the route to the crown, which is why the hunters arrived early.",
      scene_summary:
        "They are sheltering in an abandoned clocktower while rain hammers the broken glass and bootsteps echo below. Ash has just confessed who sold them out, and Mara is deciding whether to trust that confession.",
      last_turn_beat:
        "Ash revealed that their own brother betrayed the route to the crown, changing Mara's understanding of the danger.",
      relationship_state:
        "Wounded but newly honest. Mara is still wary, yet the confession has shifted them toward reluctant trust.",
      user_facts: ["Ash is a smuggler.", "Ash's brother sold the route to the crown."],
      active_threads: ["Escape the clocktower before the hunters reach the upper stair."],
      resolved_threads: ["Who betrayed the route."],
      next_turn_pressure: ["Mara must decide whether to trust Ash's confession and move now."],
      scene_goals: ["Leave the clocktower alive."],
      version: 4,
      updated_at: "2026-04-23T00:00:00.000Z",
    },
    turns: [
      makeTurn({
        id: "turn-1",
        parentTurnId: null,
        user: "You keep looking at the stairwell. What aren't you telling me?",
        assistant:
          "Mara's jaw tightens. 'That whoever sold your route knows how to count windows and watch changes. Which means they're close.'",
      }),
      makeTurn({
        id: "turn-2",
        parentTurnId: "turn-1",
        user: "Was it one of mine?",
        assistant:
          "She studies your face instead of answering. 'You tell me. Who knew the river gate timing besides your crew?'",
      }),
      makeTurn({
        id: "turn-3",
        parentTurnId: "turn-2",
        user: "My brother. He had the route, but I didn't think he'd sell it.",
        assistant:
          "Mara goes very still. Rain spits through the cracked glass behind her. 'Then stop treating that like a rumor. It's the shape of the knife already in us.'",
      }),
      makeTurn({
        id: "turn-4",
        parentTurnId: "turn-3",
        user: "I just told you it was my brother. Are you still with me or not?",
        assistant:
          "Her expression hardens into a decision instead of another question. 'I'm with you. But the hunters are already on the stair, Ash, so if we move, we move now.'",
      }),
    ],
    nextUserText: "Then stop looking at me like a suspect and tell me where we run.",
    expectations: [
      "The reply should not ask again who betrayed the route.",
      "The reply should turn the confession into a concrete escape beat.",
      "Mara should sound decisive and under pressure.",
    ],
  },
  {
    id: "emotional-loop",
    title: "Break out of repetitive emotional circling",
    focus: "Repeated vulnerable back-and-forth should turn into a new move, not the same beat again.",
    character: sharedCharacter,
    persona: sharedPersona,
    snapshot: {
      turn_id: "turn-4",
      thread_id: "thread-eval",
      branch_id: "branch-eval",
      based_on_turn_id: "turn-3",
      story_summary:
        "Ash and Mara barricaded themselves in an apothecary after a failed handoff on the river. Both have spent several turns circling the cost of trust without changing their position. The room is tense, intimate, and static, and the story needs a fresh turn rather than another round of the same confession.",
      scene_summary:
        "They are alone in the shuttered apothecary with a storm outside and a single lantern burning low. The air is thick with unfinished feeling, but nothing concrete has changed yet.",
      last_turn_beat:
        "Ash demanded honesty without leaving the emotional stalemate.",
      relationship_state:
        "Charged, vulnerable, and stuck in place. They want honesty, but the conversation keeps circling the same hurt.",
      user_facts: ["Ash wants blunt honesty from Mara."],
      active_threads: ["Break the emotional stalemate."],
      resolved_threads: [],
      next_turn_pressure: ["Someone has to change the rhythm before the scene stalls completely."],
      scene_goals: ["Force the conversation into a real decision or action."],
      version: 4,
      updated_at: "2026-04-23T00:00:00.000Z",
    },
    turns: [
      makeTurn({
        id: "turn-1",
        parentTurnId: null,
        user: "You keep saying you're fine, but you look like you're bracing for a blow.",
        assistant:
          "Mara laughs once without humor and looks away. 'Maybe I am. Maybe that's the only posture that's ever paid.'",
      }),
      makeTurn({
        id: "turn-2",
        parentTurnId: "turn-1",
        user: "I am not your enemy.",
        assistant:
          "Her shoulders loosen a fraction, then tighten again. 'No. But that doesn't mean I know how to stop expecting the knife.'",
      }),
      makeTurn({
        id: "turn-3",
        parentTurnId: "turn-2",
        user: "Then say what you actually want from me.",
        assistant:
          "The lantern throws gold across her face. 'I want one night where loyalty doesn't sound like a dare.'",
      }),
      makeTurn({
        id: "turn-4",
        parentTurnId: "turn-3",
        user: "I'm still here. What else do you need?",
        assistant:
          "Mara's mouth parts, closes, then parts again. 'I need to believe you won't vanish when this gets uglier.'",
      }),
    ],
    nextUserText: "I'm not leaving this room until you say what you actually want.",
    expectations: [
      "The reply should change the beat instead of repeating another near-identical confession.",
      "A concrete action, proposal, or pivot should happen inside the room.",
      "The voice should stay intense and intimate without becoming melodramatic mush.",
    ],
  },
  {
    id: "plot-pressure",
    title: "Push the plot forward under active pressure",
    focus: "The next reply should convert scene pressure into decisive movement.",
    character: sharedCharacter,
    persona: sharedPersona,
    snapshot: {
      turn_id: "turn-4",
      thread_id: "thread-eval",
      branch_id: "branch-eval",
      based_on_turn_id: "turn-3",
      story_summary:
        "Ash and Mara secured the map key but triggered the palace wardens. They escaped into the flood tunnels beneath the east quay, where the tunnels split toward the gatehouse and the drowned archives. The regime is minutes behind them, and the scene now needs tactical movement more than reflection.",
      scene_summary:
        "They are knee-deep in black water at a junction in the flood tunnels while torchlight flares somewhere behind them. One route leads to the gatehouse, the other to the drowned archives.",
      last_turn_beat:
        "Ash chose to follow Mara into the tunnels, committing to flight over surrender.",
      relationship_state:
        "Focused and allied under pressure. There is trust enough to move, but no time for softness.",
      user_facts: ["Ash committed to running with Mara."],
      active_threads: ["Choose the tunnel route before the wardens catch up."],
      resolved_threads: ["Whether to flee together."],
      next_turn_pressure: [
        "Pick the route immediately.",
        "Avoid the torchlight closing in from behind.",
      ],
      scene_goals: ["Get out of the flood tunnels alive."],
      version: 4,
      updated_at: "2026-04-23T00:00:00.000Z",
    },
    turns: [
      makeTurn({
        id: "turn-1",
        parentTurnId: null,
        user: "If we head for the quay, they'll cut us off in the open.",
        assistant:
          "Mara shoves the map key into her sleeve and points toward the sluice tunnel. 'Then we stay below their sightline and make them choose the wrong mouth.'",
      }),
      makeTurn({
        id: "turn-2",
        parentTurnId: "turn-1",
        user: "That archive route could collapse.",
        assistant:
          "She glances at the trembling brick overhead, then back at the black channel ahead. 'So could the gatehouse route. One gets us records, one gets us a wall to climb.'",
      }),
      makeTurn({
        id: "turn-3",
        parentTurnId: "turn-2",
        user: "You're still thinking about the archives at a time like this?",
        assistant:
          "Mara smiles with all the wrong edges. 'At a time like this is exactly when buried leverage matters.'",
      }),
      makeTurn({
        id: "turn-4",
        parentTurnId: "turn-3",
        user: "Fine. I'm with you. Just pick a direction.",
        assistant:
          "Torchlight licks the tunnel bend behind you. Mara grabs your wrist and listens once, sharply, to the water. 'Then don't argue when I choose.'",
      }),
    ],
    nextUserText: "Then choose, Mara. They're almost on us.",
    expectations: [
      "The reply should make a concrete tactical choice and act on it.",
      "The scene should end farther along the escape, not in more deliberation.",
      "The prose should feel urgent and characterful.",
    ],
  },
];
