import { decryptSecret } from "@/lib/crypto";
import { providerCatalog, uniqueModels } from "@/lib/ai/catalog";
import type { ConnectionRecord, ModelCatalogEntry, ProviderId } from "@/lib/types";

function normalizeOllamaApiBase(baseUrl?: string | null) {
  const raw = (baseUrl ?? providerCatalog.ollama.defaultBaseUrl ?? "").trim();
  if (!raw) return providerCatalog.ollama.defaultBaseUrl!;
  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  return response.json();
}

function parseOpenAIShape(
  provider: ProviderId,
  data: { data?: Array<{ id?: string }> },
) {
  return uniqueModels(
    (data.data ?? [])
      .filter((model): model is { id: string } => Boolean(model.id))
      .filter((model) => !/embed|vision|audio|image|moderation/i.test(model.id))
      .map<ModelCatalogEntry>((model) => ({
        id: model.id,
        name: model.id,
        provider,
      })),
  );
}

export async function discoverModels(connection: ConnectionRecord) {
  const apiKey = decryptSecret(connection.encrypted_api_key);

  switch (connection.provider) {
    case "google": {
      const data = (await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      )) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };

      return uniqueModels(
        (data.models ?? [])
          .filter((model): model is NonNullable<typeof model> & { name: string } => Boolean(model.name))
          .filter((model) => {
            const id = model.name.replace("models/", "");
            return (
              id.includes("gemini") &&
              !id.includes("embedding") &&
              (model.supportedGenerationMethods ?? []).includes("generateContent")
            );
          })
          .map<ModelCatalogEntry>((model) => ({
            id: model.name.replace("models/", ""),
            name: model.displayName ?? model.name.replace("models/", ""),
            provider: "google",
          })),
      );
    }
    case "groq":
      return parseOpenAIShape(
        "groq",
        (await fetchJson("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        })) as { data?: Array<{ id?: string }> },
      );
    case "mistral":
      return parseOpenAIShape(
        "mistral",
        (await fetchJson("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        })) as { data?: Array<{ id?: string }> },
      );
    case "openrouter": {
      const data = (await fetchJson("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      })) as {
        data?: Array<{ id?: string; name?: string; context_length?: number }>;
      };

      return uniqueModels(
        (data.data ?? [])
          .filter((model): model is { id: string; name?: string; context_length?: number } => Boolean(model.id))
          .filter((model) => !/vision|audio|image/i.test(model.id))
          .slice(0, 80)
          .map<ModelCatalogEntry>((model) => ({
            id: model.id,
            name: model.name ?? model.id,
            provider: "openrouter",
            contextWindow: model.context_length,
            hint: model.id.includes(":free") || model.id === "openrouter/free" ? "free" : undefined,
          })),
      );
    }
    case "ollama": {
      const data = (await fetchJson(`${normalizeOllamaApiBase(connection.base_url)}/tags`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      })) as {
        models?: Array<{ model?: string; name?: string }>;
      };

      return uniqueModels(
        (data.models ?? [])
          .filter((model): model is { model?: string; name?: string } => Boolean(model.model ?? model.name))
          .map<ModelCatalogEntry>((model) => {
            const id = model.model ?? model.name ?? "";
            return {
              id,
              name: id,
              provider: "ollama",
            };
          }),
      );
    }
    default:
      return [];
  }
}
