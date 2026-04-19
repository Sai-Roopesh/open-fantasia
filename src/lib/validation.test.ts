import { MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage } from "@/lib/chat-limits";
import { chatTurnRequestSchema, editTurnRequestSchema } from "@/lib/validation";

const branchId = "11111111-1111-4111-8111-111111111111";
const headTurnId = "22222222-2222-4222-8222-222222222222";

describe("chat turn validation", () => {
  it("accepts chat turns up to the configured limit", () => {
    const parsed = chatTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: null,
      text: "a".repeat(MAX_CHAT_TURN_TEXT),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects longer chat turns with a clear error", () => {
    const parsed = chatTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: null,
      text: "a".repeat(MAX_CHAT_TURN_TEXT + 1),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected chatTurnRequestSchema to reject over-limit text.");
    }

    expect(parsed.error.issues[0]?.message).toBe(buildChatTurnLimitMessage());
  });

  it("applies the same limit to rewritten turns", () => {
    const parsed = editTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: headTurnId,
      text: "a".repeat(MAX_CHAT_TURN_TEXT + 1),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected editTurnRequestSchema to reject over-limit text.");
    }

    expect(parsed.error.issues[0]?.message).toBe(buildChatTurnLimitMessage());
  });
});
