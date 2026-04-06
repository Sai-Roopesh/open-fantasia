import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildSnapshotFromReconciliationMock,
  claimPendingJobsMock,
  completeJobMock,
  failJobMock,
  getCharacterBundleMock,
  getConnectionMock,
  getMessagesByIdsMock,
  getPersonaMock,
  getSnapshotMock,
  insertTimelineEventMock,
  reconcileTurnStateMock,
  saveSnapshotMock,
  toUIMessagesMock,
} = vi.hoisted(() => ({
  claimPendingJobsMock: vi.fn(),
  completeJobMock: vi.fn(),
  failJobMock: vi.fn(),
  getConnectionMock: vi.fn(),
  getCharacterBundleMock: vi.fn(),
  getMessagesByIdsMock: vi.fn(),
  toUIMessagesMock: vi.fn(() => []),
  getPersonaMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  saveSnapshotMock: vi.fn(),
  insertTimelineEventMock: vi.fn(),
  reconcileTurnStateMock: vi.fn(),
  buildSnapshotFromReconciliationMock: vi.fn(() => ({
    checkpoint_id: crypto.randomUUID(),
  })),
}));

vi.mock("@/lib/data/jobs", () => ({
  claimPendingJobs: claimPendingJobsMock,
  completeJob: completeJobMock,
  failJob: failJobMock,
}));

vi.mock("@/lib/data/connections", () => ({
  getConnection: getConnectionMock,
}));

vi.mock("@/lib/data/characters", () => ({
  getCharacterBundle: getCharacterBundleMock,
}));

vi.mock("@/lib/data/messages", () => ({
  getMessagesByIds: getMessagesByIdsMock,
  toUIMessages: toUIMessagesMock,
}));

vi.mock("@/lib/data/personas", () => ({
  getPersona: getPersonaMock,
}));

vi.mock("@/lib/data/snapshots", () => ({
  getSnapshot: getSnapshotMock,
  saveSnapshot: saveSnapshotMock,
}));

vi.mock("@/lib/data/timeline", () => ({
  insertTimelineEvent: insertTimelineEventMock,
}));

vi.mock("@/lib/ai/thread-engine", () => ({
  reconcileTurnState: reconcileTurnStateMock,
  buildSnapshotFromReconciliation: buildSnapshotFromReconciliationMock,
}));

import { drainPendingJobs, parseJobPayload } from "@/lib/jobs/reconcile-worker";

function createJob(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    type: "reconcile_checkpoint",
    status: "pending",
    user_id: crypto.randomUUID(),
    thread_id: crypto.randomUUID(),
    branch_id: crypto.randomUUID(),
    checkpoint_id: crypto.randomUUID(),
    payload: {
      threadId: crypto.randomUUID(),
      branchId: crypto.randomUUID(),
      checkpointId: crypto.randomUUID(),
      previousCheckpointId: null,
      connectionId: crypto.randomUUID(),
      modelId: "model-1",
      characterId: crypto.randomUUID(),
      personaId: crypto.randomUUID(),
      recentMessageIds: ["msg-1"],
    },
    attempts: 0,
    max_attempts: 5,
    available_at: new Date().toISOString(),
    locked_at: null,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("reconcile worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid job payloads and rejects malformed ones", () => {
    expect(() => parseJobPayload({ threadId: "bad" } as never)).toThrow();
    expect(parseJobPayload(createJob().payload as never).modelId).toBe("model-1");
  });

  it("drains reconcile jobs and marks them complete", async () => {
    const job = createJob();
    claimPendingJobsMock.mockResolvedValue([job]);
    getConnectionMock.mockResolvedValue({ id: job.payload.connectionId });
    getCharacterBundleMock.mockResolvedValue({ character: { name: "Ari" } });
    getPersonaMock.mockResolvedValue({ id: job.payload.personaId });
    getSnapshotMock.mockResolvedValue(null);
    getMessagesByIdsMock.mockResolvedValue([{ id: "msg-1" }]);
    reconcileTurnStateMock.mockResolvedValue({ timelineEvent: null });
    saveSnapshotMock.mockResolvedValue(undefined);
    completeJobMock.mockResolvedValue(undefined);

    const processed = await drainPendingJobs({} as never, 1);

    expect(processed).toBe(1);
    expect(saveSnapshotMock).toHaveBeenCalled();
    expect(completeJobMock).toHaveBeenCalledWith({} as never, job.id);
    expect(failJobMock).not.toHaveBeenCalled();
  });

  it("fails malformed jobs instead of silently succeeding", async () => {
    const job = createJob({ payload: {} });
    claimPendingJobsMock.mockResolvedValue([job]);
    failJobMock.mockResolvedValue(undefined);

    await drainPendingJobs({} as never, 1);

    expect(failJobMock).toHaveBeenCalledWith(
      {} as never,
      job,
      expect.stringContaining("threadId"),
    );
    expect(completeJobMock).not.toHaveBeenCalled();
  });
});
