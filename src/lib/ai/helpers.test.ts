import { getTextFromMessageParts } from "@/lib/ai/message-text";
import { normalizeOllamaApiBaseUrl } from "@/lib/ai/ollama-url";

describe("AI utility helpers", () => {
  it("extracts only text parts from UI message parts", () => {
    expect(
      getTextFromMessageParts([
        { type: "text", text: "hello " },
        { type: "tool", toolName: "search" },
        { type: "text", text: "world" },
      ]),
    ).toBe("hello world");
  });

  it("normalizes ollama urls to a single /api suffix", () => {
    expect(normalizeOllamaApiBaseUrl("https://ollama.example.com")).toBe(
      "https://ollama.example.com/api",
    );
    expect(normalizeOllamaApiBaseUrl("https://ollama.example.com/api")).toBe(
      "https://ollama.example.com/api",
    );
  });
});
