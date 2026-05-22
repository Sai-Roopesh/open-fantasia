import { providerCatalog } from "@/lib/ai/catalog";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

function isPrivateIp(hostname: string) {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;

  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 0.0.0.0
  if (a === 0) return true;

  return false;
}

export function validateOllamaBaseUrl(baseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      "Invalid Ollama base URL. Provide a valid URL like http://my-ollama-host:11434.",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "Ollama base URL must use http:// or https://.",
    );
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new Error(
      "Ollama base URL must not point to a private or internal address.",
    );
  }
}

export function normalizeOllamaApiBaseUrl(baseUrl?: string | null) {
  const fallback = providerCatalog.ollama.defaultBaseUrl ?? "https://ollama.com/api";
  const raw = (baseUrl ?? fallback).trim();

  if (!raw) {
    return fallback;
  }

  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
}
