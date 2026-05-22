import {
  buildCharacterPortraitObjectPath,
  CHARACTER_PORTRAITS_BUCKET,
  fetchCharacterPortraitFromPollinations,
} from "@/lib/characters/portraits";
import {
  getCharacter,
  updateCharacterPortrait,
} from "@/lib/data/characters";
import {
  claimCharacterPortraitTasks,
  cleanupStaleGenerationLocks,
  completeCharacterPortraitTask,
  failCharacterPortraitTask,
} from "@/lib/data/jobs";
import type { DatabaseClient } from "@/lib/data/shared";
import type { CharacterPortraitTaskRecord } from "@/lib/types";

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
  limit = 4,
) {
  await cleanupStaleGenerationLocks(supabase).catch((error) => {
    console.error("Failed to clean up stale generation locks.", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const portraitTasks = await claimCharacterPortraitTasks(
    supabase,
    Math.max(1, limit),
  );

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
    portraitProcessed: portraitTasks.length,
    totalProcessed: portraitTasks.length,
  };
}
