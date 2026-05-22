import { describe, expect, it } from "vitest";
import { parseMarkdownLite } from "@/lib/pretext/markdown-lite";

describe("parseMarkdownLite", () => {
  it("returns a single empty paragraph for empty input", () => {
    const blocks = parseMarkdownLite("");
    expect(blocks).toEqual([{ kind: "paragraph", text: "", marks: [] }]);
  });

  it("returns a single empty paragraph for whitespace-only input", () => {
    const blocks = parseMarkdownLite("   \n\n  ");
    expect(blocks).toEqual([{ kind: "paragraph", text: "", marks: [] }]);
  });

  it("parses a plain paragraph", () => {
    const blocks = parseMarkdownLite("Hello, world!");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
    expect(blocks[0].text).toBe("Hello, world!");
    expect(blocks[0].marks).toEqual([]);
  });

  it("parses bold inline marks", () => {
    const blocks = parseMarkdownLite("A **bold** word");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("A bold word");
    expect(blocks[0].marks).toEqual([
      { start: 2, end: 6, bold: true },
    ]);
  });

  it("parses italic inline marks", () => {
    const blocks = parseMarkdownLite("An *italic* word");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("An italic word");
    expect(blocks[0].marks).toEqual([
      { start: 3, end: 9, italic: true },
    ]);
  });

  it("parses mixed bold and italic", () => {
    const blocks = parseMarkdownLite("**bold** and *italic*");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("bold and italic");
    expect(blocks[0].marks).toHaveLength(2);
    expect(blocks[0].marks[0]).toEqual({ start: 0, end: 4, bold: true });
    expect(blocks[0].marks[1]).toEqual({ start: 9, end: 15, italic: true });
  });

  it("parses a blockquote", () => {
    const blocks = parseMarkdownLite("> This is a quote");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("quote");
    expect(blocks[0].text).toBe("This is a quote");
  });

  it("parses a multi-line blockquote", () => {
    const blocks = parseMarkdownLite("> Line one\n> Line two");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("quote");
    expect(blocks[0].text).toBe("Line one\nLine two");
  });

  it("parses a separator (---)", () => {
    const blocks = parseMarkdownLite("---");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("separator");
    expect(blocks[0].text).toBe("");
  });

  it("parses a separator (***)", () => {
    const blocks = parseMarkdownLite("***");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("separator");
  });

  it("parses a separator (___)", () => {
    const blocks = parseMarkdownLite("___");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("separator");
  });

  it("parses mixed blocks: paragraph → quote → separator → paragraph", () => {
    const input = [
      "Hello world",
      "",
      "> A quoted block",
      "",
      "---",
      "",
      "Final paragraph",
    ].join("\n");

    const blocks = parseMarkdownLite(input);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].kind).toBe("paragraph");
    expect(blocks[0].text).toBe("Hello world");
    expect(blocks[1].kind).toBe("quote");
    expect(blocks[1].text).toBe("A quoted block");
    expect(blocks[2].kind).toBe("separator");
    expect(blocks[3].kind).toBe("paragraph");
    expect(blocks[3].text).toBe("Final paragraph");
  });

  it("handles consecutive paragraphs separated by blank lines", () => {
    const blocks = parseMarkdownLite("First\n\nSecond\n\nThird");
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.kind === "paragraph")).toBe(true);
    expect(blocks.map((b) => b.text)).toEqual(["First", "Second", "Third"]);
  });

  it("handles multi-line paragraphs without blank line separation", () => {
    const blocks = parseMarkdownLite("Line one\nLine two\nLine three");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
    // Multi-line paragraphs are joined with newlines
    expect(blocks[0].text).toContain("Line one");
    expect(blocks[0].text).toContain("Line two");
    expect(blocks[0].text).toContain("Line three");
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const blocks = parseMarkdownLite("Hello\r\n\r\nWorld");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe("Hello");
    expect(blocks[1].text).toBe("World");
  });

  it("handles unclosed bold markers as literal text", () => {
    const blocks = parseMarkdownLite("No **closing bold");
    expect(blocks).toHaveLength(1);
    // Unclosed markers should be treated as literal characters
    expect(blocks[0].text).toContain("**");
  });

  it("handles unclosed italic markers as literal text", () => {
    const blocks = parseMarkdownLite("No *closing italic");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toContain("*");
  });

  it("transitions from quote to paragraph correctly", () => {
    const blocks = parseMarkdownLite("> A quote\nA paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe("quote");
    expect(blocks[1].kind).toBe("paragraph");
  });
});
