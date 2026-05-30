import { discoverModels } from "@/lib/ai/model-discovery";
import {
  classifyConnectionError,
  deleteConnection,
  getConnection,
  saveConnection,
} from "@/lib/data/connections";
import type { DatabaseClient } from "@/lib/data/shared";
import { validateConnectionInput } from "@/lib/ai/catalog";
import type { ConnectionRecord, ProviderId } from "@/lib/types";

async function updateConnectionStatus(
  supabase: DatabaseClient,
  connection: ConnectionRecord,
  payload: Record<string, unknown>,
): Promise<ConnectionRecord> {
  const { error } = await supabase
    .from("ai_connections")
    .update(payload)
    .eq("id", connection.id)
    .eq("user_id", connection.user_id);

  if (error) throw error;

  const updated = await getConnection(supabase, connection.user_id, connection.id);
  if (!updated) throw new Error("Connection not found after update.");
  return updated;
}

export async function testConnectionHealth(
  supabase: DatabaseClient,
  connection: ConnectionRecord,
): Promise<ConnectionRecord> {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();

    return updateConnectionStatus(supabase, connection, {
      last_checked_at: now,
      health_status: "healthy",
      health_message: models.length
        ? `Connection verified. ${models.length} models are available to refresh.`
        : "Connection verified, but no compatible text models were detected.",
    });
  } catch (error) {
    const failure = classifyConnectionError(error);
    return updateConnectionStatus(supabase, connection, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
  }
}

export async function refreshConnectionModels(
  supabase: DatabaseClient,
  connection: ConnectionRecord,
): Promise<ConnectionRecord> {
  try {
    const models = await discoverModels(connection);
    const now = new Date().toISOString();
    const nextDefaultModelId = models.some(
      (model) => model.id === connection.default_model_id,
    )
      ? connection.default_model_id
      : (models[0]?.id ?? null);

    return updateConnectionStatus(supabase, connection, {
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
    await updateConnectionStatus(supabase, connection, {
      last_checked_at: new Date().toISOString(),
      health_status: failure.status,
      health_message: failure.message,
    });
    throw new Error(failure.message);
  }
}

export async function saveConnectionWithValidation(
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
): Promise<{ ok: true; connection: ConnectionRecord } | { ok: false; error: string }> {
  const validationError = validateConnectionInput({
    provider: payload.provider,
    apiKey: payload.apiKey ?? "",
    baseUrl: payload.baseUrl ?? "",
  });
  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    const connection = await saveConnection(supabase, userId, payload);
    return { ok: true, connection };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save connection.";
    return { ok: false, error: message };
  }
}

export async function deleteConnectionSafely(
  supabase: DatabaseClient,
  userId: string,
  connectionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteConnection(supabase, userId, connectionId);
    return { ok: true };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        error:
          "This connection is still used by one or more threads. " +
          "Switch those threads to a different provider first, then delete this lane.",
      };
    }
    const message = error instanceof Error ? error.message : "Failed to delete connection.";
    return { ok: false, error: message };
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: string }).code === "23503";
}
