import { providerCatalog } from "@/lib/ai/catalog";

export { validateOllamaBaseUrl } from "@/lib/utils/url-safety";

/**
 * Resolves the effective Ollama API base URL, applying the catalog default and
 * normalizing the `/api` suffix. Depends on the provider catalog, so it stays
 * in the AI layer rather than the pure utility layer.
 */
export function normalizeOllamaApiBaseUrl(baseUrl?: string | null) {
  const fallback = providerCatalog.ollama.defaultBaseUrl ?? "https://ollama.com/api";
  const raw = (baseUrl ?? fallback).trim();

  if (!raw) {
    return fallback;
  }

  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
}
