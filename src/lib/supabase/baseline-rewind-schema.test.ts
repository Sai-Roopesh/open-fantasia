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
      /add constraint chat_turns_parent_turn_fkey[\s\S]*on delete cascade;/,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_fork_turn_fkey[\s\S]*on delete set null;/,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_head_turn_fkey[\s\S]*on delete set null;/,
    );
    expect(baselineSql).toMatch(
      /add constraint chat_branches_locked_turn_fkey[\s\S]*on delete set null;/,
    );
    expect(baselineSql).toMatch(
      /create table public\.chat_timeline_events[\s\S]*turn_id uuid references public\.chat_turns\(id\) on delete cascade,/,
    );
    expect(baselineSql).toMatch(
      /create table public\.chat_pins[\s\S]*turn_id uuid references public\.chat_turns\(id\) on delete cascade,/,
    );
  });

  it("rewind prunes descendant turns and deletes affected branch records", () => {
    expect(baselineSql).toContain("prune_root_turn_id");
    expect(baselineSql).toContain("doomed_branch_ids");
    expect(baselineSql).toContain("delete from public.chat_turns");
    expect(baselineSql).toContain("delete from public.chat_branches");
  });
});
