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

  it("captures the squashed post-hybrid schema without legacy reconcile tasks", () => {
    expect(baselineSql).toContain("CREATE TABLE public.chat_turn_snapshots");
    expect(baselineSql).toContain("story_summary");
    expect(baselineSql).toContain("scene_summary");
    expect(baselineSql).not.toContain("turn_reconcile_tasks");
    expect(baselineSql).not.toContain("claim_turn_reconcile_tasks");
  });
});
