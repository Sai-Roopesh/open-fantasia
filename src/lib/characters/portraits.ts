import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CharacterPortraitStatus, CharacterRecord } from "@/lib/types";

export const CHARACTER_PORTRAITS_BUCKET = "character-portraits";
export const CHARACTER_PORTRAIT_SIZE = 768;

type CharacterPortraitInput = Pick<
  CharacterRecord,
  "name" | "appearance" | "tagline" | "short_description"
>;

type CharacterPortraitState = Pick<
  CharacterRecord,
  | "portrait_generated_at"
  | "portrait_last_error"
  | "portrait_path"
  | "portrait_prompt"
  | "portrait_seed"
  | "portrait_source_hash"
  | "portrait_status"
>;

export type CharacterPortraitPlan = {
  prompt: string | null;
  sourceHash: string;
  seed: number | null;
  shouldEnqueue: boolean;
  nextPortrait: CharacterPortraitState;
};

export function buildCharacterPortraitPrompt(input: CharacterPortraitInput) {
  const identity = `${input.name.trim()}, ${input.appearance.trim()}.`;
  const mood = [input.tagline.trim(), input.short_description.trim()]
    .filter(Boolean)
    .join(". ");
  const clauses = [
    identity,
    mood,
    "cinematic fantasy character portrait, upper-body, single character, detailed face, painterly concept art, atmospheric background, no text",
  ].filter(Boolean);

  return clauses.join(" ").replace(/\s+/g, " ").trim();
}

export function buildCharacterPortraitSourceHash(input: CharacterPortraitInput) {
  const normalized = JSON.stringify({
    name: input.name.trim(),
    appearance: input.appearance.trim(),
    tagline: input.tagline.trim(),
    short_description: input.short_description.trim(),
  });

  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function generateCharacterPortraitSeed() {
  return randomInt(0, 2_147_483_647);
}

export function buildCharacterPortraitObjectPath(args: {
  userId: string;
  characterId: string;
  sourceHash: string;
  seed: number;
}) {
  return `${args.userId}/${args.characterId}/${args.sourceHash}-${args.seed}.jpg`;
}

export function resolveCharacterPortraitPublicUrl(
  supabase: SupabaseClient<Database>,
  path: string | null | undefined,
) {
  const normalized = path?.trim();
  if (!normalized) return null;

  return supabase.storage
    .from(CHARACTER_PORTRAITS_BUCKET)
    .getPublicUrl(normalized).data.publicUrl;
}

export function planCharacterPortraitState(args: {
  existing: CharacterRecord | null;
  input: CharacterPortraitInput;
  forceRegenerate?: boolean;
}): CharacterPortraitPlan {
  const appearance = args.input.appearance.trim();

  if (!appearance) {
    return {
      prompt: null,
      sourceHash: "",
      seed: null,
      shouldEnqueue: false,
      nextPortrait: {
        portrait_status: "idle",
        portrait_path: "",
        portrait_prompt: "",
        portrait_seed: null,
        portrait_source_hash: "",
        portrait_last_error: "",
        portrait_generated_at: null,
      },
    };
  }

  const prompt = buildCharacterPortraitPrompt(args.input);
  const sourceHash = buildCharacterPortraitSourceHash(args.input);
  const sourceChanged = args.existing?.portrait_source_hash !== sourceHash;
  const needsPortrait =
    !args.existing?.portrait_path &&
    args.existing?.portrait_status !== "pending";
  const shouldEnqueue = Boolean(
    args.forceRegenerate || sourceChanged || needsPortrait || !args.existing,
  );

  if (!shouldEnqueue && args.existing) {
    return {
      prompt,
      sourceHash,
      seed: args.existing.portrait_seed,
      shouldEnqueue: false,
      nextPortrait: {
        portrait_status: args.existing.portrait_status,
        portrait_path: args.existing.portrait_path,
        portrait_prompt: args.existing.portrait_prompt,
        portrait_seed: args.existing.portrait_seed,
        portrait_source_hash: args.existing.portrait_source_hash,
        portrait_last_error: args.existing.portrait_last_error,
        portrait_generated_at: args.existing.portrait_generated_at,
      },
    };
  }

  const seed = generateCharacterPortraitSeed();

  return {
    prompt,
    sourceHash,
    seed,
    shouldEnqueue: true,
    nextPortrait: {
      portrait_status: "pending",
      portrait_path: "",
      portrait_prompt: prompt,
      portrait_seed: seed,
      portrait_source_hash: sourceHash,
      portrait_last_error: "",
      portrait_generated_at: null,
    },
  };
}

export async function fetchCharacterPortraitFromPollinations(args: {
  prompt: string;
  seed: number;
}) {
  const url = new URL(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}`,
  );
  url.searchParams.set("model", "sana");
  url.searchParams.set("width", String(CHARACTER_PORTRAIT_SIZE));
  url.searchParams.set("height", String(CHARACTER_PORTRAIT_SIZE));
  url.searchParams.set("seed", String(args.seed));
  url.searchParams.set("safe", "true");
  url.searchParams.set("private", "true");
  url.searchParams.set("nofeed", "true");
  url.searchParams.set("enhance", "false");
  url.searchParams.set("nologo", "true");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim() ? ` ${body.trim()}` : "";
    throw new Error(
      `Pollinations image request failed with ${response.status}.${detail}`.trim(),
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    throw new Error("Pollinations returned an empty image payload.");
  }

  return {
    contentType,
    buffer: Buffer.from(arrayBuffer),
  };
}

export function buildCharacterPortraitStatusCopy(status: CharacterPortraitStatus) {
  switch (status) {
    case "pending":
      return "Generating portrait";
    case "ready":
      return "Portrait ready";
    case "failed":
      return "Portrait failed";
    default:
      return "Portrait idle";
  }
}
