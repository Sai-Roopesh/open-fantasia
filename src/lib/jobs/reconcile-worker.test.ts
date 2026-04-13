import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCharacterPortraitObjectPathMock,
  buildSnapshotFromReconciliationMock,
  claimPendingJobsMock,
  completeJobMock,
  failJobMock,
  fetchCharacterPortraitFromPollinationsMock,
  getCharacterMock,
  getCharacterBundleMock,
  getConnectionMock,
  getMessagesByIdsMock,
  getPersonaMock,
  getSnapshotMock,
  insertTimelineEventMock,
  reconcileTurnStateMock,
  saveSnapshotMock,
  toUIMessagesMock,
  updateCharacterPortraitMock,
} = vi.hoisted(() => ({
  buildCharacterPortraitObjectPathMock: vi.fn(),
  claimPendingJobsMock: vi.fn(),
  completeJobMock: vi.fn(),
  failJobMock: vi.fn(),
  fetchCharacterPortraitFromPollinationsMock: vi.fn(),
  getCharacterMock: vi.fn(),
  getConnectionMock: vi.fn(),
  getCharacterBundleMock: vi.fn(),
  getMessagesByIdsMock: vi.fn(),
  toUIMessagesMock: vi.fn(() => []),
  getPersonaMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  saveSnapshotMock: vi.fn(),
  insertTimelineEventMock: vi.fn(),
  reconcileTurnStateMock: vi.fn(),
  updateCharacterPortraitMock: vi.fn(),
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
  getCharacter: getCharacterMock,
  getCharacterBundle: getCharacterBundleMock,
  updateCharacterPortrait: updateCharacterPortraitMock,
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

vi.mock("@/lib/characters/portraits", () => ({
  CHARACTER_PORTRAITS_BUCKET: "character-portraits",
  buildCharacterPortraitObjectPath: buildCharacterPortraitObjectPathMock,
  fetchCharacterPortraitFromPollinations: fetchCharacterPortraitFromPollinationsMock,
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

function createCharacterRecord(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    name: "Ari",
    story: "",
    core_persona: "A haunted navigator who keeps one hand on the stars.",
    greeting: "",
    appearance: "Sharp features, silver braid, midnight coat",
    style_rules: "",
    definition: "",
    negative_guidance: "",
    portrait_status: "pending",
    portrait_path: "",
    portrait_prompt: "",
    portrait_seed: null,
    portrait_source_hash: "hash-1",
    portrait_last_error: "",
    portrait_generated_at: null,
    temperature: 0.92,
    top_p: 0.94,
    max_output_tokens: 750,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createPortraitSupabase(options?: {
  maybeSingleResult?: { data: { id: string } | null; error: null };
}) {
  const maybeSingleMock = vi
    .fn()
    .mockResolvedValue(options?.maybeSingleResult ?? { data: { id: "char-1" }, error: null });
  const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqSourceHashMock = vi.fn(() => ({ select: selectMock }));
  const eqUserMock = vi.fn(() => ({ eq: eqSourceHashMock }));
  const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
  const updateMock = vi.fn(() => ({ eq: eqIdMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === "characters") {
      return { update: updateMock };
    }

    throw new Error(`Unexpected table ${table}`);
  });
  const uploadMock = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null });
  const removeMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const storageFromMock = vi.fn(() => ({
    upload: uploadMock,
    remove: removeMock,
  }));

  return {
    supabase: {
      from: fromMock,
      storage: {
        from: storageFromMock,
      },
    } as never,
    maybeSingleMock,
    removeMock,
    uploadMock,
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

  it("uploads generated portraits and marks portrait jobs complete", async () => {
    const job = createJob({
      type: "generate_character_portrait",
      thread_id: null,
      branch_id: null,
      checkpoint_id: null,
      payload: {
        characterId: crypto.randomUUID(),
        prompt: "Ari, sharp features, silver braid. cinematic fantasy character portrait",
        seed: 42,
        sourceHash: "hash-1",
      },
    });
    const portraitPayload = job.payload as unknown as {
      characterId: string;
      prompt: string;
      seed: number;
      sourceHash: string;
    };
    const portraitCharacter = createCharacterRecord({
      id: portraitPayload.characterId,
      user_id: job.user_id,
      portrait_source_hash: "hash-1",
    });
    const { supabase, maybeSingleMock, removeMock, uploadMock } = createPortraitSupabase();

    claimPendingJobsMock.mockResolvedValue([job]);
    getCharacterMock.mockResolvedValue(portraitCharacter);
    fetchCharacterPortraitFromPollinationsMock.mockResolvedValue({
      buffer: Buffer.from("portrait"),
      contentType: "image/jpeg",
    });
    buildCharacterPortraitObjectPathMock.mockReturnValue("user/character/hash-1-42.jpg");
    completeJobMock.mockResolvedValue(undefined);

    const processed = await drainPendingJobs(supabase, 1);

    expect(processed).toBe(1);
    expect(fetchCharacterPortraitFromPollinationsMock).toHaveBeenCalledWith({
      prompt: portraitPayload.prompt,
      seed: portraitPayload.seed,
    });
    expect(uploadMock).toHaveBeenCalled();
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(completeJobMock).toHaveBeenCalledWith(supabase, job.id);
    expect(failJobMock).not.toHaveBeenCalled();
  });

  it("skips stale portrait jobs without uploading over newer source hashes", async () => {
    const job = createJob({
      type: "generate_character_portrait",
      thread_id: null,
      branch_id: null,
      checkpoint_id: null,
      payload: {
        characterId: crypto.randomUUID(),
        prompt: "Ari portrait prompt",
        seed: 99,
        sourceHash: "old-hash",
      },
    });
    const portraitPayload = job.payload as unknown as {
      characterId: string;
    };
    const { supabase, uploadMock } = createPortraitSupabase();

    claimPendingJobsMock.mockResolvedValue([job]);
    getCharacterMock.mockResolvedValue(
      createCharacterRecord({
        id: portraitPayload.characterId,
        user_id: job.user_id,
        portrait_source_hash: "new-hash",
      }),
    );
    completeJobMock.mockResolvedValue(undefined);

    await drainPendingJobs(supabase, 1);

    expect(fetchCharacterPortraitFromPollinationsMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(completeJobMock).toHaveBeenCalledWith(supabase, job.id);
    expect(failJobMock).not.toHaveBeenCalled();
  });

  it("records portrait errors on the character while retries remain", async () => {
    const job = createJob({
      type: "generate_character_portrait",
      thread_id: null,
      branch_id: null,
      checkpoint_id: null,
      attempts: 2,
      max_attempts: 5,
      payload: {
        characterId: crypto.randomUUID(),
        prompt: "Ari portrait prompt",
        seed: 123,
        sourceHash: "hash-1",
      },
    });

    claimPendingJobsMock.mockResolvedValue([job]);
    getCharacterMock.mockResolvedValue(
      createCharacterRecord({
        id: job.payload.characterId,
        user_id: job.user_id,
        portrait_source_hash: "hash-1",
      }),
    );
    fetchCharacterPortraitFromPollinationsMock.mockRejectedValue(
      new Error("Pollinations image request failed with 429."),
    );
    failJobMock.mockResolvedValue(undefined);

    await drainPendingJobs({} as never, 1);

    expect(updateCharacterPortraitMock).toHaveBeenCalledWith(
      {} as never,
      job.user_id,
      job.payload.characterId,
      {
        portrait_status: "pending",
        portrait_last_error: "Pollinations image request failed with 429.",
      },
    );
    expect(failJobMock).toHaveBeenCalledWith(
      {} as never,
      job,
      "Pollinations image request failed with 429.",
    );
    expect(completeJobMock).not.toHaveBeenCalled();
  });

  it("marks portrait jobs failed on the character after the last attempt", async () => {
    const job = createJob({
      type: "generate_character_portrait",
      thread_id: null,
      branch_id: null,
      checkpoint_id: null,
      attempts: 5,
      max_attempts: 5,
      payload: {
        characterId: crypto.randomUUID(),
        prompt: "Ari portrait prompt",
        seed: 456,
        sourceHash: "hash-1",
      },
    });

    claimPendingJobsMock.mockResolvedValue([job]);
    getCharacterMock.mockResolvedValue(
      createCharacterRecord({
        id: job.payload.characterId,
        user_id: job.user_id,
        portrait_source_hash: "hash-1",
      }),
    );
    fetchCharacterPortraitFromPollinationsMock.mockRejectedValue(
      new Error("Pollinations image request failed with 500."),
    );
    failJobMock.mockResolvedValue(undefined);

    await drainPendingJobs({} as never, 1);

    expect(updateCharacterPortraitMock).toHaveBeenCalledWith(
      {} as never,
      job.user_id,
      job.payload.characterId,
      {
        portrait_status: "failed",
        portrait_last_error: "Pollinations image request failed with 500.",
      },
    );
    expect(failJobMock).toHaveBeenCalledWith(
      {} as never,
      job,
      "Pollinations image request failed with 500.",
    );
    expect(completeJobMock).not.toHaveBeenCalled();
  });
});
