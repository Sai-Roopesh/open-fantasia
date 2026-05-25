import { generateText, Output } from "ai";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import type { ConnectionRecord, CharacterRecord, DurableMemorySnapshot } from "@/lib/types";
import { extractionOutputSchema, buildExtractionSystemPrompt, type ExtractionOutput } from "@/lib/ai/state-extraction";
import type { FullValidationResult } from "@/lib/ai/state-validator";

/**
 * Strip markdown code fences and extract the JSON body from model text.
 */
function extractJsonFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

export async function reflectOnFailedExtraction(args: {
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterRecord;
  currentSnapshot: DurableMemorySnapshot;
  recentTranscript: string;
  previousOutput: ExtractionOutput;
  validationResult: FullValidationResult;
}): Promise<ExtractionOutput | null> {
  const {
    connection,
    modelId,
    character,
    currentSnapshot,
    recentTranscript,
    previousOutput,
    validationResult,
  } = args;

  const allErrors = [
    ...validationResult.entityErrors,
    ...validationResult.factErrors,
    ...validationResult.relationshipErrors,
    ...validationResult.spatialErrors,
    ...validationResult.locationEdgeErrors,
    ...validationResult.narrativeThreadErrors,
  ];

  const reflectionPrompt = `You are the Cognitive State Tracker performing a CORRECTION PASS.

Your previous extraction contained ${validationResult.totalErrors} validation errors.
You must fix these errors and return a corrected extraction.

<Validation_Errors>
${allErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}
</Validation_Errors>

<Previous_Output>
${JSON.stringify(previousOutput, null, 2)}
</Previous_Output>

<Current_State>
${JSON.stringify(currentSnapshot, null, 2)}
</Current_State>

<Recent_Transcript>
${recentTranscript}
</Recent_Transcript>

RULES FOR CORRECTION:
1. Remove any mutations that reference non-existent IDs.
2. If you referenced an entity that doesn't exist in Current_State, either:
   a. Change it to an 'add' operation if it's genuinely a new entity, or
   b. Find the correct existing entity_id from Current_State.
3. If you referenced a relationship that doesn't exist, either add it first or remove the mutation.
4. Keep all valid mutations from your previous output unchanged.
5. The story_summary, scene_summary, last_turn_beat, and narrative_timestamp should remain the same unless they were also incorrect.
6. Return the complete corrected extraction in the same schema format.
7. OUTPUT COMPACTNESS: Respond ONLY with the JSON object. Do NOT repeat Current_State. Keep strings concise.
8. Your response MUST be valid, complete JSON.`;

  try {
    const model = createLanguageModel(connection, modelId);
    const result = await generateText({
      model,
      system: buildExtractionSystemPrompt(character.name),
      messages: [{ role: "user", content: reflectionPrompt }],
      output: Output.object({ schema: extractionOutputSchema }),
      temperature: 0.1,
      maxOutputTokens: 8000,
    });

    // Primary path: use SDK structured output
    try {
      const structured = result.output;
      if (structured) {
        return extractionOutputSchema.parse(structured) as ExtractionOutput;
      }
    } catch {
      // output getter threw — fall through to text parsing
    }

    // Fallback: parse raw text
    const rawText = result.text;
    if (!rawText || rawText.trim().length === 0) {
      console.error("[HCE Reflector] Reflection pass returned empty response.");
      return null;
    }

    console.warn("[HCE Reflector] Structured output unavailable, parsing raw text fallback.", {
      modelId,
      textLength: rawText.length,
    });

    const jsonBody = extractJsonFromText(rawText);
    const parsed = JSON.parse(jsonBody);
    return extractionOutputSchema.parse(parsed) as ExtractionOutput;
  } catch (error) {
    console.error("[HCE Reflector] Reflection pass failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
