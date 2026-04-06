import { buildCheckpointPath, resolveSnapshotState } from "@/lib/data/threads";

describe("buildCheckpointPath", () => {
  it("returns the canonical path from root to head", () => {
    const rootId = crypto.randomUUID();
    const midId = crypto.randomUUID();
    const headId = crypto.randomUUID();

    const path = buildCheckpointPath(
      [
        {
          id: headId,
          parent_checkpoint_id: midId,
        },
        {
          id: rootId,
          parent_checkpoint_id: null,
        },
        {
          id: midId,
          parent_checkpoint_id: rootId,
        },
      ] as never,
      headId,
    );

    expect(path.map((checkpoint) => checkpoint.id)).toEqual([rootId, midId, headId]);
  });

  it("stops cleanly when the parent chain is broken", () => {
    const headId = crypto.randomUUID();

    const path = buildCheckpointPath(
      [
        {
          id: headId,
          parent_checkpoint_id: crypto.randomUUID(),
        },
      ] as never,
      headId,
    );

    expect(path.map((checkpoint) => checkpoint.id)).toEqual([headId]);
  });

  it("falls back to the most recent reconciled snapshot while the head is pending", () => {
    const rootId = crypto.randomUUID();
    const headId = crypto.randomUUID();
    const previousSnapshot = {
      checkpoint_id: rootId,
      scenario_state: "library",
    };

    const resolved = resolveSnapshotState(
      [
        {
          id: rootId,
          parent_checkpoint_id: null,
        },
        {
          id: headId,
          parent_checkpoint_id: rootId,
        },
      ] as never,
      new Map([[rootId, previousSnapshot as never]]),
    );

    expect(resolved.headSnapshot).toBeNull();
    expect(resolved.resolvedSnapshot).toEqual(previousSnapshot);
    expect(resolved.headSnapshotPending).toBe(true);
  });

  it("uses the head snapshot when it is already written", () => {
    const headId = crypto.randomUUID();
    const headSnapshot = {
      checkpoint_id: headId,
      scenario_state: "rooftop",
    };

    const resolved = resolveSnapshotState(
      [
        {
          id: headId,
          parent_checkpoint_id: null,
        },
      ] as never,
      new Map([[headId, headSnapshot as never]]),
    );

    expect(resolved.headSnapshot).toEqual(headSnapshot);
    expect(resolved.resolvedSnapshot).toEqual(headSnapshot);
    expect(resolved.headSnapshotPending).toBe(false);
  });
});
