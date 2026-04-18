import { buildSnapshotFromReconciliation, reconcileTurnState } from "@/lib/ai/thread-engine";
import {
  buildCharacterPortraitObjectPath,
  CHARACTER_PORTRAITS_BUCKET,
  fetchCharacterPortraitFromPollinations,
} from "@/lib/characters/portraits";
import {
  getCharacter,
  getCharacterBundle,
  updateCharacterPortrait,
} from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import {
  claimCharacterPortraitTasks,
  claimTurnReconcileTasks,
  cleanupStaleGenerationLocks,
  completeCharacterPortraitTask,
  completeTurnReconcileTask,
  failCharacterPortraitTask,
  failTurnReconcileTask,
} from "@/lib/data/jobs";
import { getPersona } from "@/lib/data/personas";
import { getSnapshot, saveSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { listTurnsForThread, toTranscriptMessages } from "@/lib/data/turns";
import type { DatabaseClient } from "@/lib/data/shared";
import type {
  CharacterPortraitTaskRecord,
  TurnReconcileTaskRecord,
} from "@/lib/types";
import { buildTurnPath } from "@/lib/threads/read-model";

async function reconcileTurnTask(
  supabase: DatabaseClient,
  task: TurnReconcileTaskRecord,
) {
  const turns = await listTurnsForThread(supabase, task.thread_id);
  const turnPath = buildTurnPath(turns, task.turn_id);
  const currentTurn = turnPath.at(-1);
  if (!currentTurn || currentTurn.id !== task.turn_id) {
    throw new Error("Reconciliation skipped: task turn is not reachable.");
  }

  const [connection, character, persona, previousSnapshot] = await Promise.all([
    getConnection(supabase, task.user_id, task.connection_id),
    getCharacterBundle(supabase, task.user_id, task.character_id),
    getPersona(supabase, task.user_id, task.persona_id),
    currentTurn.parent_turn_id
      ? getSnapshot(supabase, task.user_id, currentTurn.parent_turn_id)
      : Promise.resolve(null),
  ]);

  if (!connection) {
    throw new Error("Reconciliation skipped: connection is missing.");
  }
  if (!character) {
    throw new Error("Reconciliation skipped: character is missing.");
  }
  if (!persona) {
    throw new Error("Reconciliation skipped: persona is missing.");
  }

  const recentMessages = turnPath
    .slice(-6)
    .flatMap((turn) => toTranscriptMessages(turn));

  const reconciliation = await reconcileTurnState({
    connection,
    modelId: task.model_id,
    character,
    previousSnapshot,
    recentMessages,
  });

  await saveSnapshot(
    supabase,
    buildSnapshotFromReconciliation({
      turnId: task.turn_id,
      threadId: task.thread_id,
      branchId: task.branch_id,
      previousSnapshot,
      reconciliation,
    }),
  );

  if (reconciliation.timelineEvent) {
    await insertTimelineEvent(supabase, {
      thread_id: task.thread_id,
      branch_id: task.branch_id,
      turn_id: task.turn_id,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }
}

async function runCharacterPortraitTask(
  supabase: DatabaseClient,
  task: CharacterPortraitTaskRecord,
) {
  const character = await getCharacter(supabase, task.user_id, task.character_id);
  if (!character) {
    return;
  }

  if (!character.appearance.trim()) {
    await updateCharacterPortrait(supabase, task.user_id, character.id, {
      portrait_status: "idle",
      portrait_path: "",
      portrait_prompt: "",
      portrait_seed: null,
      portrait_source_hash: "",
      portrait_last_error: "",
      portrait_generated_at: null,
    });
    return;
  }

  if (character.portrait_source_hash !== task.source_hash) {
    return;
  }

  const image = await fetchCharacterPortraitFromPollinations({
    prompt: task.prompt,
    seed: task.seed,
  });
  const path = buildCharacterPortraitObjectPath({
    userId: task.user_id,
    characterId: character.id,
    sourceHash: task.source_hash,
    seed: task.seed,
  });

  const uploadResult = await supabase.storage
    .from(CHARACTER_PORTRAITS_BUCKET)
    .upload(path, image.buffer, {
      upsert: true,
      cacheControl: "31536000",
      contentType: image.contentType,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const { data, error } = await supabase
    .from("characters")
    .update({
      portrait_status: "ready",
      portrait_path: path,
      portrait_prompt: task.prompt,
      portrait_seed: task.seed,
      portrait_last_error: "",
      portrait_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", character.id)
    .eq("user_id", task.user_id)
    .eq("portrait_source_hash", task.source_hash)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    await supabase.storage.from(CHARACTER_PORTRAITS_BUCKET).remove([path]);
  }
}

async function syncPortraitFailureState(
  supabase: DatabaseClient,
  task: CharacterPortraitTaskRecord,
  errorMessage: string,
) {
  try {
    const character = await getCharacter(supabase, task.user_id, task.character_id);
    if (!character) {
      return;
    }

    if (character.portrait_source_hash !== task.source_hash) {
      return;
    }

    await updateCharacterPortrait(supabase, task.user_id, character.id, {
      portrait_status: task.attempts >= task.max_attempts ? "failed" : "pending",
      portrait_last_error: errorMessage,
    });
  } catch (error) {
    console.error("Failed to sync portrait failure state.", {
      taskId: task.id,
      characterId: task.character_id,
      userId: task.user_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function drainPendingTasks(
  supabase: DatabaseClient,
  limit = 10,
) {
  await cleanupStaleGenerationLocks(supabase).catch((error) => {
    console.error("Failed to clean up stale generation locks.", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const reconcileLimit = Math.max(1, Math.ceil(limit * 0.7));
  const portraitLimit = Math.max(1, limit - reconcileLimit);

  const [reconcileTasks, portraitTasks] = await Promise.all([
    claimTurnReconcileTasks(supabase, reconcileLimit),
    claimCharacterPortraitTasks(supabase, portraitLimit),
  ]);

  for (const task of reconcileTasks) {
    try {
      await reconcileTurnTask(supabase, task);
      await completeTurnReconcileTask(supabase, task.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Turn reconciliation failed.";
      console.error("Turn reconcile task failed.", {
        taskId: task.id,
        turnId: task.turn_id,
        threadId: task.thread_id,
        branchId: task.branch_id,
        userId: task.user_id,
        error: message,
      });
      try {
        await failTurnReconcileTask(supabase, task, message);
      } catch (persistError) {
        console.error("Failed to persist reconcile task failure.", {
          taskId: task.id,
          turnId: task.turn_id,
          error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
        });
      }
    }
  }

  for (const task of portraitTasks) {
    try {
      await runCharacterPortraitTask(supabase, task);
      await completeCharacterPortraitTask(supabase, task.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Character portrait generation failed.";
      console.error("Portrait task failed.", {
        taskId: task.id,
        characterId: task.character_id,
        userId: task.user_id,
        error: message,
      });
      await syncPortraitFailureState(supabase, task, message);
      try {
        await failCharacterPortraitTask(supabase, task, message);
      } catch (persistError) {
        console.error("Failed to persist portrait task failure.", {
          taskId: task.id,
          characterId: task.character_id,
          error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
        });
      }
    }
  }

  return {
    reconcileProcessed: reconcileTasks.length,
    portraitProcessed: portraitTasks.length,
    totalProcessed: reconcileTasks.length + portraitTasks.length,
  };
}
