import { describe, expect, it, vi } from "vitest";
import { ensureMessageId, toStoredMessage } from "@/lib/ai/message-utils";

describe("message utils", () => {
  it("generates a new id when a message id is blank", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("generated-id");

    const next = ensureMessageId({
      id: "",
      role: "assistant",
      parts: [{ type: "text", text: "Hello there" }],
      metadata: {},
    } as never);

    expect(next.id).toBe("generated-id");
  });

  it("persists stored messages with a non-empty id", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("stored-id");

    const stored = toStoredMessage({
      id: "",
      role: "assistant",
      parts: [{ type: "text", text: "Hello there" }],
      metadata: {},
    } as never);

    expect(stored.id).toBe("stored-id");
    expect(stored.content_text).toBe("Hello there");
  });
});
