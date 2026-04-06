import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import type { ConnectionRecord } from "@/lib/types";
import { decryptSecret } from "@/lib/crypto";
import { normalizeOllamaApiBaseUrl } from "@/lib/ai/ollama-url";

export function createLanguageModel(
  connection: ConnectionRecord,
  modelId: string,
) {
  const apiKey = decryptSecret(connection.encrypted_api_key);

  switch (connection.provider) {
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
    case "ollama":
      return createOllama({
        baseURL: normalizeOllamaApiBaseUrl(connection.base_url),
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      })(modelId);
    default:
      throw new Error(`Unsupported provider ${connection.provider}`);
  }
}
