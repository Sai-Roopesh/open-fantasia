import {
  backgroundJobRecordSchema,
  chatRequestSchema,
  jobPayloadSchema,
  saveCharacterCommandSchema,
} from "@/lib/validation";

describe("validation schemas", () => {
  it("coerces numeric character settings into numbers", () => {
    const parsed = saveCharacterCommandSchema.parse({
      name: "Selene",
      appearance: "Silver hair, moonlit eyes, velvet coat",
      temperature: "1.25",
      top_p: "0.8",
      max_output_tokens: "900",
    });

    expect(parsed.appearance).toBe("Silver hair, moonlit eyes, velvet coat");
    expect(parsed.temperature).toBe(1.25);
    expect(parsed.top_p).toBe(0.8);
    expect(parsed.max_output_tokens).toBe(900);
  });

  it("rejects invalid numeric character settings", () => {
    expect(() =>
      saveCharacterCommandSchema.parse({
        name: "Selene",
        appearance: "Silver hair",
        top_p: "0",
        max_output_tokens: "0",
      }),
    ).toThrow();
  });

  it("validates background job payloads", () => {
    expect(() =>
      jobPayloadSchema.parse({
        threadId: "not-a-uuid",
        recentMessageIds: "oops",
      }),
    ).toThrow();

    expect(() =>
      backgroundJobRecordSchema.parse({
        id: crypto.randomUUID(),
        type: "reconcile_checkpoint",
        status: "running",
        user_id: crypto.randomUUID(),
        thread_id: crypto.randomUUID(),
        branch_id: crypto.randomUUID(),
        checkpoint_id: crypto.randomUUID(),
        payload: "not-an-object",
        attempts: 1,
        max_attempts: 5,
        available_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("accepts UI messages that rely on parts instead of plain string content", () => {
    const parsed = chatRequestSchema.parse({
      threadId: crypto.randomUUID(),
      messages: [
        {
          id: "msg_1",
          role: "user",
          parts: [{ type: "text", text: "hello there" }],
        },
      ],
    });

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]?.role).toBe("user");
  });
});
