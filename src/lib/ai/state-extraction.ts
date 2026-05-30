import { Output, generateText } from "ai";
import { z } from "zod";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { getTextFromMessage } from "@/lib/utils/message-text";
import type {
  CharacterRecord,
  ConnectionRecord,
  DurableMemorySnapshot,
  FantasiaUIMessage,
} from "@/lib/types";
import {
  entityTypes,
  factTypes,
  relationshipTypes,
  narrativeThreadStatuses,
  transitionTypes,
  timelineEventTypes,
} from "@/lib/types";

// --- Entity mutations ---

const entityMutationSchema = z.object({
  op: z.enum(["add", "update", "invalidate"]),
  canonical_name: z.string().optional(),
  entity_type: z.enum(entityTypes).optional(),
  aliases: z.array(z.string()).optional(),
  is_present: z.boolean().optional(),
  primary_emotion: z.string().optional(),
  emotion_intensity: z.number().min(1).max(10).optional(),
  emotion_catalyst: z.string().optional(),
  entity_id: z.string().optional(),
  changes: z.object({
    is_present: z.boolean().optional(),
    primary_emotion: z.string().optional(),
    emotion_intensity: z.number().min(1).max(10).optional(),
    emotion_catalyst: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  }).optional(),
});

// --- Fact mutations ---

const factMutationSchema = z.object({
  op: z.enum(["add", "invalidate"]),
  entity_id: z.string().optional(),
  fact_type: z.enum(factTypes).optional(),
  body: z.string().optional(),
  fact_id: z.string().optional(),
});

// --- Relationship mutations ---

const relationshipMutationSchema = z.object({
  op: z.enum(["add", "update", "invalidate"]),
  source_entity_id: z.string().optional(),
  target_entity_id: z.string().optional(),
  relationship_type: z.enum(relationshipTypes).optional(),
  dynamic_status: z.string().optional(),
  relationship_id: z.string().optional(),
  changes: z.object({
    dynamic_status: z.string().optional(),
    relationship_type: z.enum(relationshipTypes).optional(),
  }).optional(),
});

// --- Location mutations ---

const locationMutationSchema = z.object({
  op: z.enum(["add", "update"]),
  canonical_name: z.string().optional(),
  description: z.string().optional(),
  environmental_modifiers: z.array(z.string()).optional(),
  location_id: z.string().optional(),
  changes: z.object({
    description: z.string().optional(),
    environmental_modifiers: z.array(z.string()).optional(),
  }).optional(),
});

// --- Location edge mutations ---

const locationEdgeMutationSchema = z.object({
  op: z.enum(["add", "invalidate"]),
  from_location_id: z.string().optional(),
  to_location_id: z.string().optional(),
  is_bidirectional: z.boolean().optional(),
  edge_id: z.string().optional(),
});

// --- Placement mutations ---

const placementMoveSchema = z.object({
  op: z.literal("move"),
  entity_id: z.string(),
  to_location_id: z.string(),
  micro_position: z.string().optional(),
});

// --- Narrative thread mutations ---

const narrativeThreadMutationSchema = z.object({
  op: z.enum(["add", "update", "resolve"]),
  objective: z.string().optional(),
  thread_id: z.string().optional(),
  changes: z.object({
    status: z.enum(narrativeThreadStatuses).optional(),
    objective: z.string().optional(),
  }).optional(),
});

// --- Timeline events ---

const timelineEventOutputSchema = z.object({
  title: z.string(),
  detail: z.string(),
  importance: z.number().int().min(1).max(5),
  event_type: z.enum(timelineEventTypes),
  affected_entity_ids: z.array(z.string()).optional().default([]),
  affected_relationship_ids: z.array(z.string()).optional().default([]),
});

// --- Main extraction output ---

export const extractionOutputSchema = z.object({
  transition_type: z.enum(transitionTypes),
  story_summary: z.string(),
  scene_summary: z.string(),
  last_turn_beat: z.string(),
  narrative_timestamp: z.string(),
  entity_mutations: z.array(entityMutationSchema).default([]),
  fact_mutations: z.array(factMutationSchema).default([]),
  relationship_mutations: z.array(relationshipMutationSchema).default([]),
  location_mutations: z.array(locationMutationSchema).default([]),
  location_edge_mutations: z.array(locationEdgeMutationSchema).default([]),
  placement_mutations: z.array(placementMoveSchema).default([]),
  narrative_thread_mutations: z.array(narrativeThreadMutationSchema).default([]),
  timeline_events: z.array(timelineEventOutputSchema).default([]),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

// --- Prompt construction ---

export function buildExtractionSystemPrompt(characterName: string) {
  return [
    "You are the Hybrid Continuity Engine (HCE) state extractor for a private roleplay branch.",
    `The roleplay character is "${characterName}".`,
    "Return ONLY valid JSON matching the requested schema. No prose, no markdown fences.",
    "",
    "# Task",
    "Analyze the <Latest_Transcript> against the <Current_State> and produce a minimal set of state mutation operations that capture EXACTLY what changed in the latest narrative turn.",
    "",
    "# Output fields",
    "",
    "## Summaries (regenerate every turn)",
    "- transition_type: 'continuation' if the scene continues in the same place and time, 'scene_transition' if location or context shifts, 'time_skip' if significant in-world time passes.",
    "- story_summary: 8-12 sentences summarizing the entire story so far including the latest turn.",
    "- scene_summary: 3-5 sentences describing the current scene and immediate situation after this turn.",
    "- last_turn_beat: 1-2 sentences on how the newest exchange changed the scene.",
    "- narrative_timestamp: best estimate of in-world time (e.g. 'Late evening, Day 3' or 'Morning, unknown date'). Keep the format consistent with prior timestamps in Current_State.",
    "",
    "## Entity mutations",
    "- 'add': a new character, NPC, creature, object, or group appeared for the first time. Provide canonical_name, entity_type, and optional fields.",
    "- 'update': an existing entity's presence, emotion, or aliases changed. Reference entity_id from Current_State exactly. Only include changed fields in 'changes'.",
    "- 'invalidate': an entity is permanently removed from the story (death, destruction, departure with no return).",
    "",
    "## Fact mutations",
    "- 'add': a new piece of knowledge, trait, goal, secret, ability, or possession was revealed or established. Attach it to the entity_id it belongs to.",
    "- 'invalidate': a previously recorded fact is now definitively false or obsolete. Reference the fact's id from the entity's knowledge_boundary, traits, goals, secrets, abilities, or possessions arrays in Current_State.",
    "",
    "## Relationship mutations",
    "- 'add': a new relationship formed between two entities. Use source_entity_id and target_entity_id from Current_State.",
    "- 'update': an existing relationship's dynamic_status or type changed. Reference relationship_id exactly.",
    "- 'invalidate': a relationship is permanently severed.",
    "",
    "## Location mutations",
    "- 'add': a new named location is introduced for the first time.",
    "- 'update': an existing location's description or environmental_modifiers changed. Reference location_id exactly.",
    "",
    "## Location edge mutations",
    "- 'add': a spatial connection between two locations is established or discovered.",
    "- 'invalidate': a spatial connection is permanently severed (path destroyed, portal closed).",
    "",
    "## Placement mutations",
    "- 'move': an entity physically moved to a different location. Use entity_id and to_location_id from Current_State. Use micro_position for sub-location detail (e.g. 'by the fireplace', 'at the bar counter').",
    "- If a new location is introduced and entities move there, emit the location 'add' first. In placement, reference the new location by its canonical_name prefixed with 'NEW:' (e.g. 'NEW:The Crypt').",
    "- If a new entity appears at a location, emit entity 'add' first. In placement, reference the new entity by its canonical_name prefixed with 'NEW:' (e.g. 'NEW:Shadow Wolf').",
    "",
    "## Narrative thread mutations",
    "- 'add': a new plot thread, quest, or objective emerged.",
    "- 'update': an existing thread's status or objective changed. Reference thread_id exactly.",
    "- 'resolve': a thread reached completion. Reference thread_id exactly.",
    "",
    "## Timeline events",
    "- Only create a timeline_event if the latest turn produced a genuinely notable beat: a reveal, betrayal, discovery, combat engagement, scene change, time skip, major relationship shift, significant emotional moment, or meaningful spatial movement.",
    "- Do NOT create timeline events for routine dialogue, minor reactions, or unremarkable continuations.",
    "- importance: 1 = minor note, 3 = notable moment, 5 = story-defining event.",
    "",
    "# Rules",
    "1. NEVER hallucinate changes not directly supported by the literal text of <Latest_Transcript>.",
    "2. If nothing changed in a category, return an empty array for that mutation field.",
    "3. Reference entity_id, relationship_id, location_id, edge_id, and thread_id values from <Current_State> exactly as given. Do not fabricate IDs.",
    "4. When information is revealed TO a character (not by them), add a knowledge fact to that character's entity.",
    "5. When a character physically moves, always emit a placement 'move' mutation.",
    "6. When emotions shift, emit an entity 'update' with the new primary_emotion, emotion_intensity, and emotion_catalyst.",
    "7. Summaries (story_summary, scene_summary, last_turn_beat) must incorporate the latest turn. Do not just copy the previous snapshot values.",
    "8. For the very first turn (empty Current_State), add all initial entities, locations, relationships, and facts as 'add' operations.",
    "9. Keep mutation operations minimal. Do not re-add entities or facts that already exist in Current_State unchanged.",
    "10. If the Current_State is empty or minimal, this is an initialization turn — be thorough in establishing the world state from the transcript.",
    "11. OUTPUT COMPACTNESS: Respond ONLY with the JSON object. Do NOT repeat or echo back Current_State. Keep strings concise. Omit optional fields when unchanged.",
    "12. Your response MUST be valid, complete JSON. Do not truncate, do not add trailing commentary.",
  ].join("\n");
}

export function buildExtractionUserMessage(
  snapshot: DurableMemorySnapshot,
  recentTranscript: string,
) {
  return [
    "<Current_State>",
    JSON.stringify(snapshot, null, 2),
    "</Current_State>",
    "",
    "<Latest_Transcript>",
    recentTranscript || "No transcript available.",
    "</Latest_Transcript>",
  ].join("\n");
}

function formatTranscript(messages: FantasiaUIMessage[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${getTextFromMessage(message)}`)
    .join("\n\n");
}

/**
 * Strip markdown code fences and extract the JSON body from model text.
 * Models like Mistral sometimes wrap structured output in ```json ... ```
 * even when constrained decoding is requested.
 */
function extractJsonFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to find a top-level JSON object
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

export async function extractStateChanges(args: {
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterRecord;
  currentSnapshot: DurableMemorySnapshot;
  recentMessages: FantasiaUIMessage[];
  isFullMaterialization?: boolean;
}): Promise<ExtractionOutput> {
  const transcript = formatTranscript(args.recentMessages);

  let systemPrompt = buildExtractionSystemPrompt(args.character.name);

  if (args.isFullMaterialization) {
    systemPrompt += [
      "",
      "",
      "# Full re-materialization mode",
      "This is a PERIODIC FULL RE-DERIVATION (defragmentation) of the world state.",
      "You must verify every entity, fact, relationship, location, and narrative thread in Current_State against the Latest_Transcript.",
      "",
      "CRITICAL ANTI-DRIFT RULES:",
      "- PRESERVATION IS THE DEFAULT. Only change what is clearly wrong, missing, or contradicted by the transcript.",
      "- Do NOT rewrite entities, facts, or relationships that are accurately captured in Current_State.",
      "- Do NOT remove plot threads or facts just because they weren't mentioned recently — they may still be relevant.",
      "- If Current_State accurately reflects the transcript, emit minimal or zero mutations.",
      "- Invalidate state ONLY if the transcript provides clear evidence that it is no longer true.",
      "- Add missing state that was dropped by previous incremental extractions.",
      "- Ensure the story_summary is comprehensive and up-to-date.",
      "- Think of this as an AUDIT, not a rewrite.",
    ].join("\n");
  }

  const userMessage = buildExtractionUserMessage(
    args.currentSnapshot,
    transcript,
  );

  const result = await generateText({
    model: createLanguageModel(args.connection, args.modelId),
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
    output: Output.object({ schema: extractionOutputSchema }),
    temperature: 0.15,
    maxOutputTokens: 8000,
  });

  // Primary path: use the SDK's structured output if available.
  // Some providers (Mistral, Groq) may not support constrained decoding for
  // complex schemas, causing result.output to be null/undefined or throwing
  // NoOutputGeneratedError. In that case, fall back to parsing the raw text.
  try {
    const structured = result.output;
    if (structured) {
      return extractionOutputSchema.parse(structured);
    }
  } catch {
    // output getter threw NoOutputGeneratedError — fall through to text parsing
  }

  // Fallback: parse the raw text response (may be wrapped in markdown fences)
  const rawText = result.text;
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("HCE extraction returned empty response from model.");
  }

  console.warn("[HCE] Structured output unavailable, parsing raw text fallback.", {
    modelId: args.modelId,
    textLength: rawText.length,
  });

  const jsonBody = extractJsonFromText(rawText);
  const parsed = JSON.parse(jsonBody);
  return extractionOutputSchema.parse(parsed);
}
