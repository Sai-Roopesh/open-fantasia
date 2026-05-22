import { discoverModels } from "@/lib/ai/model-discovery";
import { validateOllamaBaseUrl } from "@/lib/ai/ollama-url";
import { encryptSecret } from "@/lib/crypto";
import { isConfigurationError } from "@/lib/errors";
import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type { ConnectionRecord, ProviderId } from "@/lib/types";
import { connectionRecordSchema } from "@/lib/validation";

const connectionSelect = [
  "id",
  "user_id",
  "provider",
  "label",
  "base_url",
  "encrypted_api_key",
  "enabled",
  "default_model_id",
  "model_cache",
  "health_status",
  "health_message",
  "last_checked_at",
  "last_model_refresh_at",
  "last_synced_at",
  "created_at",
  "updated_at",
].join(", ");

function normalizeConnection(value: unknown, label = "Connection") {
  return parseRow(value, connectionRecordSchema, label);
}

function normalizeConnections(value: unknown, label = "Connections") {
  return parseRows(value, connectionRecordSchema, label);
}

function extractErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    cause?: unknown;
  };

  if (typeof candidate.status === "number") {
    return { status: candidate.status, code: null as string | null };
  }

  if (typeof candidate.statusCode === "number") {
    return { status: candidate.statusCode, code: null as string | null };
  }

  if (typeof candidate.code === "string") {
    return { status: null as number | null, code: candidate.code };
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const nested = candidate.cause as { code?: unknown; status?: unknown; statusCode?: unknown };
    return {
      status:
        typeof nested.status === "number"
          ? nested.status
          : typeof nested.statusCode === "number"
            ? nested.statusCode
            : null,
      code: typeof nested.code === "string" ? nested.code : null,
    };
  }

  return null;
}

export function classifyConnectionError(error: unknown) {
  if (isConfigurationError(error)) {
    return {
      status: "bad_config" as const,
      message: "The stored provider secret is malformed. Save the connection again.",
    };
  }

  const detail = extractErrorStatus(error);
  if (detail?.status === 429) {
    return {
      status: "rate_limited" as const,
      message: "The provider accepted the request, but the connection is currently rate limited.",
    };
  }

  if (detail?.status === 401 || detail?.status === 403) {
    return {
      status: "auth_failed" as const,
      message: "The provider rejected this key. Double-check the API key and account permissions.",
    };
  }

  if (
    detail?.status === 404 ||
    detail?.code === "ENOTFOUND" ||
    detail?.code === "ECONNREFUSED" ||
    detail?.code === "EHOSTUNREACH"
  ) {
    return {
      status: "bad_base_url" as const,
      message: "Fantasia could not reach that provider endpoint. Check the base URL and network path.",
    };
  }

  const rawMessage =
    error instanceof Error ? error.message.toLowerCase() : "connection check failed";

  if (rawMessage.includes("rate limit") || rawMessage.includes("quota")) {
    return {
      status: "rate_limited" as const,
      message: "The provider accepted the request, but the connection is currently rate limited.",
    };
  }

  if (
    rawMessage.includes("unauthorized") ||
    rawMessage.includes("forbidden") ||
    rawMessage.includes("invalid api key") ||
    rawMessage.includes("authentication")
  ) {
    return {
      status: "auth_failed" as const,
      message: "The provider rejected this key. Double-check the API key and account permissions.",
    };
  }

  if (
    rawMessage.includes("fetch failed") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("econnrefused") ||
    rawMessage.includes("getaddrinfo")
  ) {
    return {
      status: "bad_base_url" as const,
      message: "Fantasia could not reach that provider endpoint. Check the base URL and network path.",
    };
  }

  return {
    status: "error" as const,
    message: "Fantasia could not verify this connection.",
  };
}

async function updateConnection(
  supabase: DatabaseClient,
  connectionId: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("ai_connections")
    .update(payload)
    .eq("id", connectionId)
    .eq("user_id", userId)
    .select(connectionSelect)
    .single();

  if (error) {
    throw error;
  }

  return normalizeConnection(data, "Updated connection");
}

export async function listConnections(supabase: DatabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("ai_connections")
    .select(connectionSelect)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return normalizeConnections(data ?? [], "Connection list");
}

export async function getConnection(
  supabase: DatabaseClient,
  userId: string,
  connectionId: string,
) {
  const { data, error } = await supabase
    .from("ai_connections")
    .select(connectionSelect)
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeConnection(data, "Connection") : null;
}

function resolveNextDefaultModelId(
  current: ConnectionRecord | null,
  payload: {
    defaultModelId?: string | null;
    connectionChanged: boolean;
  },
) {
  if (payload.connectionChanged) {
    return null;
  }

  if (payload.defaultModelId !== undefined) {
    return payload.defaultModelId;
  }

  return current?.default_model_id ?? null;
}

export async function saveConnection(
  supabase: DatabaseClient,
  userId: string,
  payload: {
    id?: string;
    provider: ProviderId;
    label: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    enabled: boolean;
    defaultModelId?: string | null;
  },
) {
  const nextBaseUrl = payload.baseUrl?.trim() || null;
  if (payload.provider === "ollama" && nextBaseUrl) {
    validateOllamaBaseUrl(nextBaseUrl);
  }

  const current = payload.id
    ? await getConnection(supabase, userId, payload.id)
    : null;
  const keyExplicitlyChanged = Boolean(payload.apiKey?.trim());
  const nextEncryptedApiKey = keyExplicitlyChanged
    ? encryptSecret(payload.apiKey!.trim())
    : current?.encrypted_api_key ?? null;
  const connectionChanged =
    !current ||
    current.provider !== payload.provider ||
    current.base_url !== nextBaseUrl ||
    keyExplicitlyChanged;

  const nextRecord = {
    user_id: userId,
    provider: payload.provider,
    label: payload.label,
    base_url: nextBaseUrl,
    encrypted_api_key: nextEncryptedApiKey,
    enabled: payload.enabled,
    default_model_id: resolveNextDefaultModelId(current, {
      defaultModelId: payload.defaultModelId,
      connectionChanged,
    }),
    model_cache: connectionChanged ? [] : current?.model_cache ?? [],
    health_status:
      connectionChanged ? "untested" : current?.health_status ?? "untested",
    health_message: connectionChanged ? "" : current?.health_message ?? "",
    last_checked_at: connectionChanged ? null : current?.last_checked_at ?? null,
    last_model_refresh_at:
      connectionChanged ? null : current?.last_model_refresh_at ?? null,
    last_synced_at: connectionChanged ? null : current?.last_synced_at ?? null,
  };

  const query = payload.id
    ? supabase
        .from("ai_connections")
        .update(nextRecord)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(connectionSelect)
        .single()
    : supabase
        .from("ai_connections")
        .insert(nextRecord)
        .select(connectionSelect)
        .single();

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return normalizeConnection(data, "Saved connection");
}

export async function deleteConnection(
  supabase: DatabaseClient,
  userId: string,
  connectionId: string,
) {
  const { error } = await supabase
    .from("ai_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function refreshConnectionModels(
  supabase: DatabaseClient,
  connection: ConnectionRecord,
) {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();
    const nextDefaultModelId = models.some(
      (model) => model.id === connection.default_model_id,
    )
      ? connection.default_model_id
      : models[0]?.id ?? null;

    return await updateConnection(supabase, connection.id, connection.user_id, {
      model_cache: models,
      default_model_id: nextDefaultModelId,
      last_synced_at: now,
      last_checked_at: now,
      last_model_refresh_at: now,
      health_status: "healthy",
      health_message: models.length
        ? `Connected successfully. ${models.length} text-capable models are ready.`
        : "Connected successfully, but no text-capable models were returned.",
    });
  } catch (error) {
    const failure = classifyConnectionError(error);
    await updateConnection(supabase, connection.id, connection.user_id, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
    throw new Error(failure.message);
  }
}

export async function testConnection(
  supabase: DatabaseClient,
  connection: ConnectionRecord,
) {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();

    return await updateConnection(supabase, connection.id, connection.user_id, {
      last_checked_at: now,
      health_status: "healthy",
      health_message: models.length
        ? `Connection verified. ${models.length} models are available to refresh.`
        : "Connection verified, but no compatible text models were detected.",
    });
  } catch (error) {
    const failure = classifyConnectionError(error);
    return updateConnection(supabase, connection.id, connection.user_id, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
  }
}
