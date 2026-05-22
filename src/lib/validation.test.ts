import { MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage } from "@/lib/chat-limits";
import { chatTurnRequestSchema, rewriteLatestTurnRequestSchema } from "@/lib/validation";

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
    const parsed = rewriteLatestTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: headTurnId,
      mode: "user",
      text: "a".repeat(MAX_CHAT_TURN_TEXT + 1),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected rewriteLatestTurnRequestSchema to reject over-limit text.");
    }

    expect(parsed.error.issues[0]?.message).toBe(buildChatTurnLimitMessage());
  });

  it("accepts rewriting the latest user turn", () => {
    const parsed = rewriteLatestTurnRequestSchema.parse({
      branchId,
      expectedHeadTurnId: headTurnId,
      mode: "user",
      text: "Rewrite this.",
    });

    expect(parsed.mode).toBe("user");
  });

  it("also accepts editing the latest assistant turn", () => {
    const parsed = rewriteLatestTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: headTurnId,
      mode: "assistant",
      text: "Keep only context a.",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts regenerating the latest turn without replacement text", () => {
    const parsed = rewriteLatestTurnRequestSchema.safeParse({
      branchId,
      expectedHeadTurnId: headTurnId,
      mode: "regenerate",
    });

    expect(parsed.success).toBe(true);
  });
});
