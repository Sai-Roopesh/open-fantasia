import { ZodError } from "zod";
import {
  parsePortableDocument,
  type OpenFantasiaCharacterData,
  type OpenFantasiaPersonaData,
} from "@/lib/portability/openfantasia-json";

export type PortableImportKind = "character" | "persona";

export function getLatestImportText(
  rawImport: string,
  liveValue: string | null | undefined,
) {
  return typeof liveValue === "string" ? liveValue : rawImport;
}

export function hasImportText(value: string) {
  return value.trim().length > 0;
}

export function validatePortableImport(
  kind: "character",
  rawInput: string,
):
  | {
      ok: true;
      data: OpenFantasiaCharacterData;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };
export function validatePortableImport(
  kind: "persona",
  rawInput: string,
):
  | {
      ok: true;
      data: OpenFantasiaPersonaData;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };
export function validatePortableImport(
  kind: PortableImportKind,
  rawInput: string,
):
  | {
      ok: true;
      data: OpenFantasiaCharacterData | OpenFantasiaPersonaData;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };
export function validatePortableImport(
  kind: PortableImportKind,
  rawInput: string,
) {
  try {
    const parsed =
      kind === "character"
        ? parsePortableDocument("character", rawInput).data
        : parsePortableDocument("persona", rawInput).data;

    return {
      ok: true as const,
      data: parsed,
      message: `Valid ${kind} JSON detected. Preview it here or load it straight into this draft.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: formatImportValidationError(kind, error),
    };
  }
}

function formatImportValidationError(
  kind: PortableImportKind,
  error: unknown,
) {
  if (error instanceof SyntaxError) {
    return `This ${kind} JSON is malformed: ${error.message}`;
  }

  if (error instanceof ZodError) {
    const [issue] = error.issues;

    if (!issue) {
      return `This ${kind} JSON does not match the Open-Fantasia schema.`;
    }

    const path = issue.path.length > 0 ? issue.path.join(".") : "document";
    return `This ${kind} JSON does not match the Open-Fantasia schema at ${path}: ${issue.message}.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `That ${kind} JSON could not be parsed.`;
}
