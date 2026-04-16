import { describe, expect, it, vi } from "vitest";
import { assignServerMessageId, toStoredMessage } from "@/lib/ai/message-utils";

describe("message utils", () => {
  it("always generates a fresh id regardless of existing id", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("generated-id");

    const next = assignServerMessageId({
      id: "client-supplied-id",
      role: "assistant",
      parts: [{ type: "text", text: "Hello there" }],
      metadata: {},
    } as never);

    expect(next.id).toBe("generated-id");
  });

  it("generates a fresh id when a message id is blank", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("generated-id");

    const next = assignServerMessageId({
      id: "",
      role: "assistant",
      parts: [{ type: "text", text: "Hello there" }],
      metadata: {},
    } as never);

    expect(next.id).toBe("generated-id");
  });

  it("toStoredMessage preserves the message id as-is", () => {
    const stored = toStoredMessage({
      id: "existing-server-id",
      role: "assistant",
      parts: [{ type: "text", text: "Hello there" }],
      metadata: {},
    } as never);

    expect(stored.id).toBe("existing-server-id");
    expect(stored.content_text).toBe("Hello there");
  });
});
