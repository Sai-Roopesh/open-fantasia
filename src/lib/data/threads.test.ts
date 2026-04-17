import { buildCheckpointPath, resolveSnapshotState } from "@/lib/threads/read-model";

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

  it("keeps the head snapshot empty while the latest checkpoint is still pending", () => {
    const rootId = crypto.randomUUID();
    const headId = crypto.randomUUID();

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
      new Map([
        [
          rootId,
          {
            checkpoint_id: rootId,
            scenario_state: "library",
          } as never,
        ],
      ]),
    );

    expect(resolved.headSnapshot).toBeNull();
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
    expect(resolved.headSnapshotPending).toBe(false);
  });

  it("marks the head as failed when the latest reconcile job failed", () => {
    const rootId = crypto.randomUUID();
    const headId = crypto.randomUUID();

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
      new Map([
        [
          rootId,
          {
            checkpoint_id: rootId,
            scenario_state: "library",
          } as never,
        ],
      ]),
      {
        status: "failed",
        last_error: "Worker crashed while reconciling.",
      },
    );

    expect(resolved.headSnapshot).toBeNull();
    expect(resolved.headSnapshotPending).toBe(false);
    expect(resolved.headSnapshotFailed).toBe(true);
    expect(resolved.headSnapshotFailureMessage).toBe(
      "Worker crashed while reconciling.",
    );
  });
});
