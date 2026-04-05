import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "@/lib/crypto";
import { discoverModels } from "@/lib/ai/model-discovery";
import type { ConnectionRecord, ModelCatalogEntry, ProviderId } from "@/lib/types";

function normalizeConnection(connection: ConnectionRecord) {
  return {
    ...connection,
    model_cache: Array.isArray(connection.model_cache)
      ? (connection.model_cache as ModelCatalogEntry[])
      : [],
    health_status: connection.health_status ?? "untested",
    health_message: connection.health_message ?? "",
    last_checked_at: connection.last_checked_at ?? null,
    last_model_refresh_at: connection.last_model_refresh_at ?? null,
  } satisfies ConnectionRecord;
}

function classifyConnectionError(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : "Connection check failed.";
  const message = rawMessage.toLowerCase();

  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("quota")
  ) {
    return {
      status: "rate_limited" as const,
      message:
        "The provider accepted the request, but the connection is currently rate limited.",
    };
  }

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid api key") ||
    message.includes("authentication")
  ) {
    return {
      status: "auth_failed" as const,
      message:
        "The provider rejected this key. Double-check the API key and account permissions.",
    };
  }

  if (
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("getaddrinfo") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("404") ||
    message.includes("not found")
  ) {
    return {
      status: "bad_base_url" as const,
      message:
        "Fantasia could not reach that provider endpoint. Check the base URL and network path.",
    };
  }

  return {
    status: "error" as const,
    message: rawMessage || "Fantasia could not verify this connection.",
  };
}

async function updateConnectionHealth(
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  payload: Partial<
    Pick<
      ConnectionRecord,
      | "health_status"
      | "health_message"
      | "last_checked_at"
      | "last_model_refresh_at"
      | "model_cache"
      | "last_synced_at"
    >
  >,
) {
  const { data, error } = await supabase
    .from("ai_connections")
    .update(payload)
    .eq("id", connectionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeConnection(data as ConnectionRecord);
}

export async function listConnections(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("ai_connections")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ConnectionRecord[]).map(normalizeConnection);
}

export async function getConnection(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
) {
  const { data, error } = await supabase
    .from("ai_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeConnection(data as ConnectionRecord);
}

export async function saveConnection(
  supabase: SupabaseClient,
  userId: string,
  payload: {
    id?: string;
    provider: ProviderId;
    label: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    enabled: boolean;
  },
) {
  const current = payload.id
    ? await getConnection(supabase, userId, payload.id)
    : null;
  const nextEncryptedApiKey =
    payload.apiKey && payload.apiKey.trim().length > 0
      ? encryptSecret(payload.apiKey.trim())
      : current?.encrypted_api_key ?? null;
  const nextBaseUrl = payload.baseUrl?.trim() || null;
  const connectionChanged =
    !current ||
    current.provider !== payload.provider ||
    (current.base_url ?? null) !== nextBaseUrl ||
    current.encrypted_api_key !== nextEncryptedApiKey;

  const next = {
    user_id: userId,
    provider: payload.provider,
    label: payload.label,
    base_url: nextBaseUrl,
    encrypted_api_key: nextEncryptedApiKey,
    enabled: payload.enabled,
    health_status:
      connectionChanged ? "untested" : current?.health_status ?? "untested",
    health_message: connectionChanged ? "" : current?.health_message ?? "",
    last_checked_at: connectionChanged ? null : current?.last_checked_at ?? null,
    last_model_refresh_at:
      connectionChanged ? null : current?.last_model_refresh_at ?? null,
    model_cache: connectionChanged ? [] : current?.model_cache ?? [],
    last_synced_at: connectionChanged ? null : current?.last_synced_at ?? null,
  };

  const query = payload.id
    ? supabase
        .from("ai_connections")
        .update(next)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select("*")
        .single()
    : supabase.from("ai_connections").insert(next).select("*").single();

  const { data, error } = await query;
  if (error) throw error;

  return normalizeConnection(data as ConnectionRecord);
}

export async function deleteConnection(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
) {
  const { error } = await supabase
    .from("ai_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function refreshConnectionModels(
  supabase: SupabaseClient,
  connection: ConnectionRecord,
) {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();
    return await updateConnectionHealth(supabase, connection.id, connection.user_id, {
      model_cache: models,
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
    await updateConnectionHealth(supabase, connection.id, connection.user_id, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
    throw new Error(failure.message);
  }
}

export async function testConnection(
  supabase: SupabaseClient,
  connection: ConnectionRecord,
) {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();
    return await updateConnectionHealth(supabase, connection.id, connection.user_id, {
      last_checked_at: now,
      health_status: "healthy",
      health_message: models.length
        ? `Connection verified. ${models.length} models are available to refresh.`
        : "Connection verified, but no compatible text models were detected.",
    });
  } catch (error) {
    const failure = classifyConnectionError(error);
    return updateConnectionHealth(supabase, connection.id, connection.user_id, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
  }
}
