import type { ModelCatalogEntry, ProviderCatalog, ProviderId } from "@/lib/types";

export const providerCatalog: Record<ProviderId, ProviderCatalog> = {
  google: {
    id: "google",
    name: "Google AI Studio",
    description: "Gemini models through your own AI Studio key.",
    setupUrl: "https://aistudio.google.com/app/apikey",
    requiresKey: true,
  },
  groq: {
    id: "groq",
    name: "Groq",
    description: "Fast hosted open models with separate free-tier quotas.",
    setupUrl: "https://console.groq.com/keys",
    requiresKey: true,
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    description: "Mistral chat models through your own account.",
    setupUrl: "https://console.mistral.ai/api-keys/",
    requiresKey: true,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified routing across many hosted models.",
    setupUrl: "https://openrouter.ai/keys",
    requiresKey: true,
  },
  ollama: {
    id: "ollama",
    name: "Ollama Cloud / Remote",
    description: "Ollama Cloud or a remote Ollama-compatible deployment.",
    setupUrl: "https://ollama.com/settings/keys",
    requiresKey: false,
    defaultBaseUrl: "https://ollama.com/api",
  },
};

export function connectionNeedsApiKey(provider: ProviderId, baseUrl?: string | null) {
  if (provider !== "ollama") return true;
  const normalized = (baseUrl ?? providerCatalog.ollama.defaultBaseUrl ?? "").toLowerCase();
  return normalized.includes("ollama.com");
}

export function validateConnectionInput(args: {
  provider: ProviderId;
  apiKey?: string;
  baseUrl?: string;
}) {
  const apiKey = args.apiKey?.trim() ?? "";
  if (connectionNeedsApiKey(args.provider, args.baseUrl) && !apiKey) {
    return `${providerCatalog[args.provider].name} requires an API key for this connection.`;
  }

  if (!apiKey) return null;

  switch (args.provider) {
    case "google":
      return apiKey.startsWith("AIza")
        ? null
        : "Google AI Studio keys usually start with AIza.";
    case "groq":
      return apiKey.startsWith("gsk_") ? null : "Groq keys usually start with gsk_.";
    case "openrouter":
      return apiKey.startsWith("sk-or-")
        ? null
        : "OpenRouter keys usually start with sk-or-.";
    case "mistral":
      return apiKey.length >= 20 ? null : "Mistral API keys look incomplete.";
    case "ollama":
      return null;
    default:
      return null;
  }
}

export function uniqueModels(models: ModelCatalogEntry[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}
