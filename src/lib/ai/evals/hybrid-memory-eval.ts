import { Output, convertToModelMessages, generateText } from "ai";
import { z } from "zod";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildGenerationMessages } from "@/lib/ai/thread-generation-service";
import { encryptSecret } from "@/lib/crypto";
import { toModelContextMessages } from "@/lib/data/turns";
import { buildRecentSceneMessages, createTextMessage } from "@/lib/threads/read-model";
import type {
  ConnectionRecord,
  ProviderId,
  ThreadStateSnapshot,
} from "@/lib/types";
import {
  type HybridMemoryEvalCase,
  hybridMemoryEvalFixtures,
} from "@/lib/ai/evals/hybrid-memory-fixtures";

const rubricSchema = z.object({
  forwardProgress: z.number().int().min(1).max(5),
  nonRepetition: z.number().int().min(1).max(5),
  continuityRetention: z.number().int().min(1).max(5),
  characterConsistency: z.number().int().min(1).max(5),
  summary: z.string(),
});

type RubricScore = z.infer<typeof rubricSchema>;

export type HybridMemoryEvalConfig = {
  provider: ProviderId;
  modelId: string;
  apiKey: string;
  baseUrl?: string | null;
  judgeModelId?: string;
  fixtureIds?: string[];
};

type Variant = "baseline" | "hybrid";

export type HybridMemoryEvalCaseResult = {
  fixtureId: string;
  title: string;
  baseline: RubricScore & { total: number; response: string };
  hybrid: RubricScore & { total: number; response: string };
};

export type HybridMemoryEvalReport = {
  comparedFixtureIds: string[];
  baselineAverage: {
    forwardProgress: number;
    nonRepetition: number;
    continuityRetention: number;
    characterConsistency: number;
    total: number;
  };
  hybridAverage: {
    forwardProgress: number;
    nonRepetition: number;
    continuityRetention: number;
    characterConsistency: number;
    total: number;
  };
  passed: boolean;
  caseResults: HybridMemoryEvalCaseResult[];
};

function roundScore(value: number) {
  return Number(value.toFixed(2));
}

function makeEvalConnection(config: HybridMemoryEvalConfig): ConnectionRecord {
  return {
    id: "eval-connection",
    user_id: "eval-user",
    provider: config.provider,
    label: "Hybrid Memory Eval",
    base_url: config.baseUrl ?? null,
    encrypted_api_key: encryptSecret(config.apiKey),
    enabled: true,
    default_model_id: config.modelId,
    model_cache: [],
    health_status: "healthy",
    health_message: "",
    last_checked_at: null,
    last_model_refresh_at: null,
    last_synced_at: null,
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T00:00:00.000Z",
  };
}

function buildLegacySystemPrompt(args: {
  character: HybridMemoryEvalCase["character"];
  persona: HybridMemoryEvalCase["persona"];
  snapshot: ThreadStateSnapshot;
}) {
  const { character, persona, snapshot } = args;
  return [
    `You are roleplaying as ${character.character.name}.`,
    "",
    "STORY AND SETTING",
    character.character.story,
    "",
    "CHARACTER",
    `Personality: ${character.character.core_persona}`,
    `Writing style: ${character.character.style_rules}`,
    `Behavior rules: ${character.character.definition}`,
    `Boundaries: ${character.character.negative_guidance}`,
    "",
    "USER PERSONA",
    `Name: ${persona.name}`,
    `Identity: ${persona.identity}`,
    `Backstory: ${persona.backstory}`,
    `Voice style: ${persona.voice_style}`,
    `Goals: ${persona.goals}`,
    "",
    "NARRATIVE STATE",
    `Current scenario: ${snapshot.scene_summary}`,
    `Relationship: ${snapshot.relationship_state}`,
    `What happened so far: ${snapshot.story_summary}`,
    `Known facts about the user: ${snapshot.user_facts.join("; ") || "None yet."}`,
    "",
    "ACTIVE THREADS",
    `Unresolved story threads:\n${snapshot.active_threads.map((item) => `- ${item}`).join("\n") || "- None active."}`,
    `Narrative hooks:\n${snapshot.next_turn_pressure.map((item) => `- ${item}`).join("\n") || "- None yet."}`,
    `Resolved threads:\n${snapshot.resolved_threads.map((item) => `- ${item}`).join("\n") || "- Nothing resolved yet."}`,
    `Scene goals:\n${snapshot.scene_goals.map((item) => `- ${item}`).join("\n") || "- None set."}`,
    "",
    "DIRECTIVES",
    "- Be proactive and vivid.",
    "- React to the latest user message and move the scene forward.",
    "- Never narrate for the user.",
    "- Stay in character.",
    "",
    "ANTI-REPETITION",
    "- Avoid repeating the same question if it was already answered.",
    "- If a thread feels resolved, move on.",
    "- Try not to loop on the same emotional beat.",
  ].join("\n");
}

function buildTranscriptForJudging(fixture: HybridMemoryEvalCase) {
  const lines = fixture.turns.flatMap((turn) => [
    `USER: ${turn.user_input_text}`,
    `ASSISTANT: ${turn.assistant_output_text ?? ""}`,
  ]);
  lines.push(`USER: ${fixture.nextUserText}`);
  return lines.join("\n\n");
}

async function generateVariantResponse(args: {
  connection: ConnectionRecord;
  modelId: string;
  fixture: HybridMemoryEvalCase;
  variant: Variant;
}) {
  const userMessage = createTextMessage({
    role: "user",
    text: args.fixture.nextUserText,
  });
  const messages =
    args.variant === "hybrid"
      ? buildGenerationMessages({
          recentSceneMessages: buildRecentSceneMessages(args.fixture.turns),
          pendingMessages: [userMessage],
        })
      : [
          ...args.fixture.turns.flatMap((turn) => toModelContextMessages(turn)),
          userMessage,
        ];

  const system =
    args.variant === "hybrid"
      ? buildRoleplaySystemPrompt({
          character: args.fixture.character,
          persona: args.fixture.persona,
          snapshot: args.fixture.snapshot,
          pins: [],
          timeline: [],
        })
      : buildLegacySystemPrompt({
          character: args.fixture.character,
          persona: args.fixture.persona,
          snapshot: args.fixture.snapshot,
        });

  const result = await generateText({
    model: createLanguageModel(args.connection, args.modelId),
    system,
    messages: await convertToModelMessages(messages),
    temperature: args.fixture.character.character.temperature,
    topP: args.fixture.character.character.top_p,
    maxOutputTokens: args.fixture.character.character.max_output_tokens,
  });

  return result.text.trim();
}

async function scoreResponse(args: {
  connection: ConnectionRecord;
  judgeModelId: string;
  fixture: HybridMemoryEvalCase;
  response: string;
}) {
  const result = await generateText({
    model: createLanguageModel(args.connection, args.judgeModelId),
    messages: [
      {
        role: "system",
        content: [
          "You are grading a roleplay assistant response.",
          "Return only JSON that matches the schema.",
          "",
          "Scoring rubric:",
          "- forwardProgress: 1 means the reply stalls or repeats; 5 means it advances the scene by a concrete beat.",
          "- nonRepetition: 1 means it re-asks answered questions or loops the same emotional beat; 5 means it clearly avoids repetition.",
          "- continuityRetention: 1 means it drops or contradicts established facts; 5 means it cleanly preserves relevant memory and resolved status.",
          "- characterConsistency: 1 means the voice feels generic or out of character; 5 means it strongly matches the character guidance.",
          "- summary: a brief reason for the score profile.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Fixture: ${args.fixture.title}`,
          `Focus: ${args.fixture.focus}`,
          `Expectations: ${args.fixture.expectations.join(" | ")}`,
          "",
          "<character>",
          `Name: ${args.fixture.character.character.name}`,
          `Story: ${args.fixture.character.character.story}`,
          `Persona: ${args.fixture.character.character.core_persona}`,
          `Style: ${args.fixture.character.character.style_rules}`,
          "</character>",
          "",
          "<memory>",
          `Story summary: ${args.fixture.snapshot.story_summary}`,
          `Scene summary: ${args.fixture.snapshot.scene_summary}`,
          `Last beat: ${args.fixture.snapshot.last_turn_beat}`,
          `Relationship: ${args.fixture.snapshot.relationship_state}`,
          `Active threads: ${args.fixture.snapshot.active_threads.join("; ") || "None"}`,
          `Resolved threads: ${args.fixture.snapshot.resolved_threads.join("; ") || "None"}`,
          `Next pressure: ${args.fixture.snapshot.next_turn_pressure.join("; ") || "None"}`,
          "</memory>",
          "",
          "<transcript>",
          buildTranscriptForJudging(args.fixture),
          "</transcript>",
          "",
          "<assistant_reply>",
          args.response,
          "</assistant_reply>",
        ].join("\n"),
      },
    ],
    output: Output.object({ schema: rubricSchema }),
    temperature: 0,
    maxOutputTokens: 500,
  });

  const output = await result.output;
  const total =
    output.forwardProgress +
    output.nonRepetition +
    output.continuityRetention +
    output.characterConsistency;

  return {
    ...output,
    total,
  };
}

function summarizeAverage(caseResults: HybridMemoryEvalCaseResult[], variant: Variant) {
  const divisor = caseResults.length || 1;
  const totals = caseResults.reduce(
    (acc, result) => {
      const score = result[variant];
      acc.forwardProgress += score.forwardProgress;
      acc.nonRepetition += score.nonRepetition;
      acc.continuityRetention += score.continuityRetention;
      acc.characterConsistency += score.characterConsistency;
      acc.total += score.total;
      return acc;
    },
    {
      forwardProgress: 0,
      nonRepetition: 0,
      continuityRetention: 0,
      characterConsistency: 0,
      total: 0,
    },
  );

  return {
    forwardProgress: roundScore(totals.forwardProgress / divisor),
    nonRepetition: roundScore(totals.nonRepetition / divisor),
    continuityRetention: roundScore(totals.continuityRetention / divisor),
    characterConsistency: roundScore(totals.characterConsistency / divisor),
    total: roundScore(totals.total / divisor),
  };
}

export async function runHybridMemoryEval(
  config: HybridMemoryEvalConfig,
): Promise<HybridMemoryEvalReport> {
  const connection = makeEvalConnection(config);
  const judgeModelId = config.judgeModelId ?? config.modelId;
  const fixtures = config.fixtureIds?.length
    ? hybridMemoryEvalFixtures.filter((fixture) => config.fixtureIds?.includes(fixture.id))
    : hybridMemoryEvalFixtures;

  if (!fixtures.length) {
    throw new Error("No matching hybrid-memory eval fixtures were selected.");
  }

  const caseResults: HybridMemoryEvalCaseResult[] = [];

  for (const fixture of fixtures) {
    const [baselineResponse, hybridResponse] = await Promise.all([
      generateVariantResponse({
        connection,
        modelId: config.modelId,
        fixture,
        variant: "baseline",
      }),
      generateVariantResponse({
        connection,
        modelId: config.modelId,
        fixture,
        variant: "hybrid",
      }),
    ]);

    const [baselineScore, hybridScore] = await Promise.all([
      scoreResponse({
        connection,
        judgeModelId,
        fixture,
        response: baselineResponse,
      }),
      scoreResponse({
        connection,
        judgeModelId,
        fixture,
        response: hybridResponse,
      }),
    ]);

    caseResults.push({
      fixtureId: fixture.id,
      title: fixture.title,
      baseline: { ...baselineScore, response: baselineResponse },
      hybrid: { ...hybridScore, response: hybridResponse },
    });
  }

  const baselineAverage = summarizeAverage(caseResults, "baseline");
  const hybridAverage = summarizeAverage(caseResults, "hybrid");
  const passed =
    hybridAverage.total > baselineAverage.total &&
    hybridAverage.forwardProgress >= baselineAverage.forwardProgress &&
    hybridAverage.nonRepetition >= baselineAverage.nonRepetition;

  return {
    comparedFixtureIds: fixtures.map((fixture) => fixture.id),
    baselineAverage,
    hybridAverage,
    passed,
    caseResults,
  };
}
