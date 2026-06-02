/**
 * Backfill HCE world snapshots for committed turns that have none.
 *
 * Runs the real continuity pipeline (`materializeSnapshotForTurn`) once per
 * committed turn, in ancestor → descendant (created_at) order, so each turn's
 * snapshot is built on its parent's freshly-written snapshot — exactly what the
 * live app would have produced inline at commit time. Sequential by necessity:
 * turn N's extraction reads turn N-1's snapshot. Idempotent: turns that already
 * own a snapshot are skipped.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-snapshots.ts [threadId ...]
 *   (no args → every thread owned by the fixed user)
 *
 * Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * APP_ENCRYPTION_KEY (to decrypt the brain connection's API key).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local into process.env before importing app modules that read env.
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  const key = line.slice(0, i).trim();
  const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!(key in process.env)) process.env[key] = value;
}

async function main() {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { FIXED_USER_ID } = await import("@/lib/auth-config");
  const { getThread } = await import("@/lib/data/threads");
  const { listTurnsForThread } = await import("@/lib/data/turns");
  const { getConnection } = await import("@/lib/data/connections");
  const { getCharacterBundle } = await import("@/lib/data/characters");
  const { getWorldSnapshot } = await import("@/lib/data/world-state");
  const { materializeSnapshotForTurn } = await import("@/lib/services/continuity-service");

  const supabase = createSupabaseAdminClient();
  const userId = FIXED_USER_ID;

  async function resolveThreadIds(): Promise<string[]> {
    const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
    if (args.length > 0) return args;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  async function backfillThread(threadId: string) {
    const thread = await getThread(supabase, userId, threadId);
    if (!thread) {
      console.log(`\n[${threadId}] not found / not owned — skipping`);
      return { created: 0, skipped: 0, failed: 0 };
    }

    const brainConnectionId = thread.brain_connection_id ?? thread.connection_id;
    const brainModelId = thread.brain_model_id ?? thread.model_id;
    const brainConnection = await getConnection(supabase, userId, brainConnectionId);
    const bundle = await getCharacterBundle(supabase, userId, thread.character_id);
    if (!brainConnection || !bundle) {
      console.log(`\n[${threadId}] missing brain connection or character — skipping`);
      return { created: 0, skipped: 0, failed: 0 };
    }
    const character = bundle.character;

    const turns = await listTurnsForThread(supabase, threadId);
    const committed = turns
      .filter((t) => t.generation_status === "committed")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    console.log(
      `\n[${thread.title}] (${threadId})\n  ${committed.length} committed turns | brain=${brainConnection.label}/${brainModelId}`,
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const [idx, turn] of committed.entries()) {
      const pos = `[${idx + 1}/${committed.length}] ${turn.id.slice(0, 8)}`;
      const existing = await getWorldSnapshot(supabase, turn.id);
      if (existing) {
        skipped++;
        console.log(`  ${pos} already has a snapshot — skip`);
        continue;
      }
      try {
        const snap = await materializeSnapshotForTurn({
          supabase,
          userId,
          threadId,
          turnId: turn.id,
          connection: brainConnection,
          modelId: brainModelId,
          character,
        });
        if (snap) {
          created++;
          console.log(
            `  ${pos} ✓ v${snap.metadata.version} entities=${snap.entity_state.length} rels=${snap.relational_state.length}`,
          );
        } else {
          failed++;
          console.log(`  ${pos} ✗ returned null (turn not committed?)`);
        }
      } catch (error) {
        failed++;
        console.log(`  ${pos} ✗ ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`  → created=${created} skipped=${skipped} failed=${failed}`);
    return { created, skipped, failed };
  }

  const threadIds = await resolveThreadIds();
  console.log(`Backfilling ${threadIds.length} thread(s) as user ${userId}`);

  const totals = { created: 0, skipped: 0, failed: 0 };
  for (const threadId of threadIds) {
    const r = await backfillThread(threadId);
    totals.created += r.created;
    totals.skipped += r.skipped;
    totals.failed += r.failed;
  }

  console.log(
    `\n==== TOTAL: created=${totals.created} skipped=${totals.skipped} failed=${totals.failed} ====`,
  );
  return totals.failed;
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
