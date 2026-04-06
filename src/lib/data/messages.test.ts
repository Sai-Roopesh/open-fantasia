import { toUIMessages } from "@/lib/data/messages";

describe("toUIMessages", () => {
  it("hides internal transcript seed messages by default", () => {
    const messages = [
      {
        id: "hidden-user",
        role: "user",
        parts: [{ type: "text", text: "hidden starter" }],
        metadata: { hiddenFromTranscript: true },
        created_at: new Date().toISOString(),
      },
      {
        id: "assistant-opening",
        role: "assistant",
        parts: [{ type: "text", text: "visible assistant opener" }],
        metadata: null,
        created_at: new Date().toISOString(),
      },
    ] as never;

    const result = toUIMessages(messages);

    expect(result.map((message) => message.id)).toEqual(["assistant-opening"]);
  });

  it("keeps internal messages when the caller requests full model context", () => {
    const messages = [
      {
        id: "hidden-user",
        role: "user",
        parts: [{ type: "text", text: "hidden starter" }],
        metadata: { hiddenFromTranscript: true },
        created_at: new Date().toISOString(),
      },
      {
        id: "assistant-opening",
        role: "assistant",
        parts: [{ type: "text", text: "visible assistant opener" }],
        metadata: null,
        created_at: new Date().toISOString(),
      },
    ] as never;

    const result = toUIMessages(messages, { includeHidden: true });

    expect(result.map((message) => message.id)).toEqual([
      "hidden-user",
      "assistant-opening",
    ]);
  });
});
