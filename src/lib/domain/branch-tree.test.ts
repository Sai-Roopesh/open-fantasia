import { describe, expect, it } from "vitest";
import { buildBranchTree } from "@/lib/domain/branch-tree";
import type { ChatBranchRecord } from "@/lib/types";

function branch(overrides: Partial<ChatBranchRecord> & { id: string }): ChatBranchRecord {
  return {
    thread_id: "t1",
    name: overrides.id,
    parent_branch_id: null,
    fork_turn_id: null,
    head_turn_id: null,
    is_active: false,
    generation_locked: false,
    locked_by_turn_id: null,
    locked_at: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildBranchTree", () => {
  it("nests forked branches under their parent, ordered by creation", () => {
    const branches = [
      branch({ id: "main", created_at: "2026-01-01T00:00:00Z" }),
      branch({ id: "b2", parent_branch_id: "main", created_at: "2026-01-03T00:00:00Z" }),
      branch({ id: "b1", parent_branch_id: "main", created_at: "2026-01-02T00:00:00Z" }),
      branch({ id: "b1a", parent_branch_id: "b1", created_at: "2026-01-04T00:00:00Z" }),
    ];

    const tree = buildBranchTree(branches);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("main");
    expect(tree[0].children.map((c) => c.id)).toEqual(["b1", "b2"]); // creation order
    expect(tree[0].children[0].children.map((c) => c.id)).toEqual(["b1a"]);
  });

  it("reattaches orphan branches (missing parent) at the root", () => {
    const tree = buildBranchTree([
      branch({ id: "orphan", parent_branch_id: "gone" }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(["orphan"]);
  });
});
