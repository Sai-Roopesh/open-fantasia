import { providerCatalog } from "@/lib/ai/catalog";

export function normalizeOllamaApiBaseUrl(baseUrl?: string | null) {
  const fallback = providerCatalog.ollama.defaultBaseUrl ?? "https://ollama.com/api";
  const raw = (baseUrl ?? fallback).trim();

  if (!raw) {
    return fallback;
  }

  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
}
