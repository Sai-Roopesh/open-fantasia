import { z } from "zod";

export const promptTargets = ["generic", "claude", "gemini"] as const;
export type PromptTarget = (typeof promptTargets)[number];
export const openFantasiaCharacterDocumentVersion = 2 as const;
export const openFantasiaPersonaDocumentVersion = 1 as const;

export const openFantasiaCharacterDataSchema = z
  .object({
    name: z.string(),
    appearance: z.string(),
    tagline: z.string(),
    short_description: z.string(),
    long_description: z.string(),
    greeting: z.string(),
    core_persona: z.string(),
    style_rules: z.string(),
    scenario_seed: z.string(),
    definition: z.string(),
    negative_guidance: z.string(),
    author_notes: z.string(),
    suggested_starters: z.array(z.string()),
    example_conversations: z.array(
      z
        .object({
          user_line: z.string(),
          character_line: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const openFantasiaPersonaDataSchema = z
  .object({
    name: z.string(),
    identity: z.string(),
    backstory: z.string(),
    voice_style: z.string(),
    goals: z.string(),
    boundaries: z.string(),
    private_notes: z.string(),
  })
  .strict();

export const openFantasiaCharacterDocumentSchema = z
  .object({
    format: z.literal("openfantasia.character"),
    version: z.literal(openFantasiaCharacterDocumentVersion),
    data: openFantasiaCharacterDataSchema,
  })
  .strict();

export const openFantasiaPersonaDocumentSchema = z
  .object({
    format: z.literal("openfantasia.persona"),
    version: z.literal(openFantasiaPersonaDocumentVersion),
    data: openFantasiaPersonaDataSchema,
  })
  .strict();

export type OpenFantasiaCharacterData = z.infer<typeof openFantasiaCharacterDataSchema>;
export type OpenFantasiaPersonaData = z.infer<typeof openFantasiaPersonaDataSchema>;
export type OpenFantasiaCharacterDocument = z.infer<
  typeof openFantasiaCharacterDocumentSchema
>;
export type OpenFantasiaPersonaDocument = z.infer<
  typeof openFantasiaPersonaDocumentSchema
>;

export const openFantasiaCharacterDataDefaults: OpenFantasiaCharacterData = {
  name: "",
  appearance: "",
  tagline: "",
  short_description: "",
  long_description: "",
  greeting: "",
  core_persona: "",
  style_rules: "",
  scenario_seed: "",
  definition: "",
  negative_guidance: "",
  author_notes: "",
  suggested_starters: [],
  example_conversations: [],
};

export const openFantasiaPersonaDataDefaults: OpenFantasiaPersonaData = {
  name: "",
  identity: "",
  backstory: "",
  voice_style: "",
  goals: "",
  boundaries: "",
  private_notes: "",
};

export const openFantasiaCharacterJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Open-Fantasia Character Document",
  type: "object",
  additionalProperties: false,
  required: ["format", "version", "data"],
  properties: {
    format: { const: "openfantasia.character" },
    version: { const: openFantasiaCharacterDocumentVersion },
    data: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "appearance",
        "tagline",
        "short_description",
        "long_description",
        "greeting",
        "core_persona",
        "style_rules",
        "scenario_seed",
        "definition",
        "negative_guidance",
        "author_notes",
        "suggested_starters",
        "example_conversations",
      ],
      properties: {
        name: { type: "string" },
        appearance: { type: "string" },
        tagline: { type: "string" },
        short_description: { type: "string" },
        long_description: { type: "string" },
        greeting: { type: "string" },
        core_persona: { type: "string" },
        style_rules: { type: "string" },
        scenario_seed: { type: "string" },
        definition: { type: "string" },
        negative_guidance: { type: "string" },
        author_notes: { type: "string" },
        suggested_starters: {
          type: "array",
          items: { type: "string" },
        },
        example_conversations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["user_line", "character_line"],
            properties: {
              user_line: { type: "string" },
              character_line: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

export const openFantasiaPersonaJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Open-Fantasia Persona Document",
  type: "object",
  additionalProperties: false,
  required: ["format", "version", "data"],
  properties: {
    format: { const: "openfantasia.persona" },
    version: { const: openFantasiaPersonaDocumentVersion },
    data: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "identity",
        "backstory",
        "voice_style",
        "goals",
        "boundaries",
        "private_notes",
      ],
      properties: {
        name: { type: "string" },
        identity: { type: "string" },
        backstory: { type: "string" },
        voice_style: { type: "string" },
        goals: { type: "string" },
        boundaries: { type: "string" },
        private_notes: { type: "string" },
      },
    },
  },
} as const;

export function createBlankCharacterDocument(): OpenFantasiaCharacterDocument {
  return {
    format: "openfantasia.character",
    version: openFantasiaCharacterDocumentVersion,
    data: structuredClone(openFantasiaCharacterDataDefaults),
  };
}

export function createBlankPersonaDocument(): OpenFantasiaPersonaDocument {
  return {
    format: "openfantasia.persona",
    version: openFantasiaPersonaDocumentVersion,
    data: structuredClone(openFantasiaPersonaDataDefaults),
  };
}

export function parsePortableDocument(
  kind: "character",
  rawInput: string,
): OpenFantasiaCharacterDocument;
export function parsePortableDocument(
  kind: "persona",
  rawInput: string,
): OpenFantasiaPersonaDocument;
export function parsePortableDocument(
  kind: "character" | "persona",
  rawInput: string,
) {
  const normalized = stripMarkdownCodeFence(rawInput);
  const parsed = JSON.parse(normalized) as unknown;

  if (kind === "character") {
    return openFantasiaCharacterDocumentSchema.parse(parsed);
  }

  return openFantasiaPersonaDocumentSchema.parse(parsed);
}

export function documentToJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildPromptPack(
  kind: "character",
  target: PromptTarget,
): string;
export function buildPromptPack(
  kind: "persona",
  target: PromptTarget,
): string;
export function buildPromptPack(
  kind: "character" | "persona",
  target: PromptTarget,
) {
  const title = kind === "character" ? "character" : "persona";
  const schema =
    kind === "character"
      ? openFantasiaCharacterJsonSchema
      : openFantasiaPersonaJsonSchema;
  const template =
    kind === "character"
      ? createBlankCharacterDocument()
      : createBlankPersonaDocument();

  const targetNote =
    target === "claude"
      ? "Claude-ready note: use the schema as the hard contract. You may reason however you want internally, but your final answer must be one raw JSON object and nothing else."
      : target === "gemini"
        ? "Gemini-ready note: if JSON schema or structured output mode is available, enforce the attached schema directly. If not, still return one raw JSON object and nothing else."
        : "LLM-ready note: keep the final answer as one raw JSON object only. No commentary, no markdown fences, no preamble.";

  const taskRules =
    kind === "character"
      ? [
          "Write a vivid, roleplay-ready Open-Fantasia character.",
          "Fill every field, even if some fields stay intentionally brief.",
          "Suggested starters should feel like concrete scene openings, not generic greetings.",
          "Example conversations should teach rhythm and voice, not repeat the summary.",
        ]
      : [
          "Write a vivid, usable Open-Fantasia persona.",
          "Fill every field, even if some fields stay intentionally brief.",
          "Keep the persona coherent as a playable user identity, not as a character sheet for the assistant.",
        ];

  return [
    `# Open-Fantasia ${kind === "character" ? "Character" : "Persona"} Prompt Pack`,
    "",
    `You are generating an Open-Fantasia ${title} document.`,
    "",
    "## Output rules",
    "- Return exactly one JSON object.",
    "- Do not wrap the JSON in markdown fences.",
    "- Do not add commentary before or after the JSON.",
    "- Do not omit required keys.",
    "- Do not add extra keys.",
    "",
    `## ${target === "generic" ? "Model" : capitalize(target)} note`,
    targetNote,
    "",
    "## Content rules",
    ...taskRules.map((rule) => `- ${rule}`),
    "",
    "## JSON template",
    "```json",
    documentToJson(template).trimEnd(),
    "```",
    "",
    "## JSON Schema",
    "```json",
    documentToJson(schema).trimEnd(),
    "```",
  ].join("\n");
}

export function promptPackFilename(
  kind: "character" | "persona",
  target: PromptTarget,
) {
  return `openfantasia-${kind}-${target}-prompt-pack.md`;
}

export function schemaFilename(kind: "character" | "persona") {
  const version =
    kind === "character"
      ? openFantasiaCharacterDocumentVersion
      : openFantasiaPersonaDocumentVersion;
  return `openfantasia-${kind}-schema.v${version}.json`;
}

export function templateFilename(
  kind: "character" | "persona",
  variant: "blank" | "export",
) {
  const version =
    kind === "character"
      ? openFantasiaCharacterDocumentVersion
      : openFantasiaPersonaDocumentVersion;
  return `openfantasia-${kind}-${variant}.v${version}.json`;
}

function stripMarkdownCodeFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
