import { CHARACTER_PORTRAIT_SIZE } from "@/lib/domain/character-portraits";

export const CHARACTER_PORTRAITS_BUCKET = "character-portraits";

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
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Pollinations returned an unexpected content-type: ${contentType}`,
    );
  }

  const MAX_PORTRAIT_BYTES = 10 * 1024 * 1024;
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    throw new Error("Pollinations returned an empty image payload.");
  }
  if (arrayBuffer.byteLength > MAX_PORTRAIT_BYTES) {
    throw new Error(
      `Portrait image exceeds maximum allowed size (${MAX_PORTRAIT_BYTES} bytes).`,
    );
  }

  return {
    contentType,
    buffer: Buffer.from(arrayBuffer),
  };
}
