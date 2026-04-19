import { buildChatTurnLimitMessage } from "@/lib/chat-limits";
import { humanizeChatError } from "@/components/chat/chat-workspace-helpers";

describe("humanizeChatError", () => {
  it("normalizes rate limit and auth errors", () => {
    expect(humanizeChatError("429 rate limit")).toContain("rate limited");
    expect(humanizeChatError("Unauthorized request")).toContain("rejected");
  });

  it("unwraps transport JSON and surfaces the chat limit message", () => {
    expect(
      humanizeChatError(`{"error":"${buildChatTurnLimitMessage()}"}`),
    ).toBe(buildChatTurnLimitMessage());
    expect(humanizeChatError('{"error":"Invalid chat payload."}')).toBe(
      buildChatTurnLimitMessage(),
    );
  });

  it("preserves unknown errors", () => {
    expect(humanizeChatError("Something custom happened")).toBe(
      "Something custom happened",
    );
  });
});
