import type { CharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import type { DatabaseClient } from "@/lib/data/shared";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import { ThreadGenerationServiceError } from "@/lib/ai/generation-helpers";
import { materializeSnapshotForTurn } from "@/lib/services/continuity-service";
import { loadThreadAssemblyWithSnapshot } from "@/lib/services/thread-reader";
import type {
  ConnectionRecord,
  SnapshotResolution,
  ThreadGenerationSettings,
  UserPersonaRecord,
} from "@/lib/types";
import type { ThreadAssembly } from "@/lib/domain/thread-assembly";

export type GenerationRuntime = {
  supabase: DatabaseClient;
  userId: string;
  assembly: ThreadAssembly;
  snapshot: SnapshotResolution;
  character: CharacterBundle;
  connection: ConnectionRecord;
  persona: UserPersonaRecord | null;
  generationSettings: ThreadGenerationSettings;
  brainConnection: ConnectionRecord;
  brainModelId: string;
};

export async function loadGenerationRuntime(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<GenerationRuntime> {
  const assembled = await loadThreadAssemblyWithSnapshot(supabase, userId, threadId);
  if (!assembled) {
    throw new ThreadGenerationServiceError(404, "Thread not found.");
  }

  const { assembly, snapshot } = assembled;

  // Persona is optional: a thread can run on the character sheet alone. When a
  // persona_id is set we load it; a missing record degrades to no persona
  // rather than blocking generation.
  const [connection, persona] = await Promise.all([
    getConnection(supabase, userId, assembly.thread.connection_id),
    assembly.thread.persona_id
      ? getPersona(supabase, userId, assembly.thread.persona_id)
      : Promise.resolve(null),
  ]);

  if (!assembly.characterBundle || !connection) {
    throw new ThreadGenerationServiceError(400, "Missing thread context.");
  }

  let brainConnection = connection;
  const brainModelId = assembly.thread.brain_model_id ?? assembly.thread.model_id;

  if (assembly.thread.brain_connection_id) {
    const loadedBrainConn = await getConnection(
      supabase,
      userId,
      assembly.thread.brain_connection_id,
    );
    if (loadedBrainConn) {
      brainConnection = loadedBrainConn;
    }
  }

  // If the latest committed turn has no snapshot yet, materialize it now.
  // This replaces the old pattern of mutating threadView.headSnapshot in place.
  let resolvedSnapshot = snapshot;
  const latestTurn = assembly.latestTurn;
  if (latestTurn && latestTurn.generation_status === "committed" && !snapshot.snapshot) {
    const materialized = await materializeSnapshotForTurn({
      supabase,
      userId,
      threadId,
      turnId: latestTurn.id,
      connection: brainConnection,
      modelId: brainModelId,
      character: assembly.characterBundle.character,
    });
    resolvedSnapshot = {
      snapshot: materialized,
      isPending: false,
      isFailed: false,
      failureMessage: null,
    };
  }

  return {
    supabase,
    userId,
    assembly,
    snapshot: resolvedSnapshot,
    character: assembly.characterBundle,
    connection,
    persona,
    generationSettings: resolveThreadGenerationSettings({
      character: assembly.characterBundle.character,
      thread: assembly.thread,
    }),
    brainConnection,
    brainModelId,
  };
}
