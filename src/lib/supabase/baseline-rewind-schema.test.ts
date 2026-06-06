import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const baselineSql = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/0001_baseline.sql"),
  "utf8",
);

describe("baseline rewind schema", () => {
  it("cascades turn subtree deletion through turn-linked data", () => {
    expect(baselineSql).toMatch(
      /add constraint chat_turns_parent_turn_fkey[\s\S]*on delete cascade;/i,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_fork_turn_fkey[\s\S]*on delete set null;/i,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_head_turn_fkey[\s\S]*on delete set null;/i,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_locked_turn_fkey[\s\S]*on delete set null;/i,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_timeline_events_turn_id_fkey[\s\S]*on delete cascade;/i,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_pins_turn_id_fkey[\s\S]*on delete cascade;/i,
    );
  });

  it("rewind prunes descendant turns and deletes affected branch records", () => {
    expect(baselineSql).toContain("prune_root_turn_id");
    expect(baselineSql).toContain("doomed_branch_ids");
    expect(baselineSql).toContain("delete from public.chat_turns");
    expect(baselineSql).toContain("delete from public.chat_branches");
  });

  it("captures the JSONB world-state schema without the legacy normalized tables", () => {
    expect(baselineSql).toContain("CREATE TABLE public.world_snapshots");
    expect(baselineSql).toMatch(/world_state jsonb/i);
    // The normalized world_* tables and the old scalar narrative columns were
    // collapsed into the world_state JSONB blob (former migrations 0005-0007).
    expect(baselineSql).not.toContain("world_entities");
    expect(baselineSql).not.toContain("world_relationships");
    expect(baselineSql).not.toContain("story_summary");
    expect(baselineSql).not.toContain("scene_summary");
    // The old queued continuity pipeline is gone.
    expect(baselineSql).not.toContain("turn_reconcile_tasks");
    expect(baselineSql).not.toContain("claim_turn_reconcile_tasks");
  });

  it("encodes the single-user identity model (explicit p_user_id, fixed seed)", () => {
    // auth.uid() is NULL under the service-role client, so ownership RPCs take an
    // explicit p_user_id (former migration 0009).
    expect(baselineSql).toMatch(/begin_turn\(p_user_id uuid/i);
    expect(baselineSql).toMatch(/commit_turn\(p_user_id uuid/i);
    // The single fixed user is seeded directly (former migration 0008).
    expect(baselineSql).toContain("00000000-0000-4000-8000-0000000f0001");
  });
});
