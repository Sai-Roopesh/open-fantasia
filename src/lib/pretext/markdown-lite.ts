export type InlineMark = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
};

export type RichTextBlock = {
  kind: "paragraph" | "quote" | "separator";
  text: string;
  marks: InlineMark[];
};

function normalizeMarks(marks: InlineMark[]) {
  return marks
    .filter((mark) => mark.end > mark.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function parseInline(line: string) {
  let plain = "";
  const marks: InlineMark[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    if (line.startsWith("**", cursor)) {
      const end = line.indexOf("**", cursor + 2);
      if (end > cursor + 2) {
        const content = line.slice(cursor + 2, end);
        const start = plain.length;
        plain += content;
        marks.push({ start, end: plain.length, bold: true });
        cursor = end + 2;
        continue;
      }
    }

    if (line[cursor] === "*") {
      const end = line.indexOf("*", cursor + 1);
      if (end > cursor + 1) {
        const content = line.slice(cursor + 1, end);
        const start = plain.length;
        plain += content;
        marks.push({ start, end: plain.length, italic: true });
        cursor = end + 1;
        continue;
      }
    }

    plain += line[cursor];
    cursor += 1;
  }

  return { text: plain, marks: normalizeMarks(marks) };
}

function flushBlock(
  blocks: RichTextBlock[],
  kind: "paragraph" | "quote" | null,
  lines: string[],
) {
  if (!kind || lines.length === 0) return;
  const parsed = parseInline(lines.join("\n"));
  blocks.push({ kind, text: parsed.text, marks: parsed.marks });
}

export function parseMarkdownLite(input: string) {
  const blocks: RichTextBlock[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  let currentKind: "paragraph" | "quote" | null = null;
  let buffer: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushBlock(blocks, currentKind, buffer);
      currentKind = null;
      buffer = [];
      continue;
    }

    if (/^([-*_]\s*){3,}$/.test(trimmed)) {
      flushBlock(blocks, currentKind, buffer);
      currentKind = null;
      buffer = [];
      blocks.push({ kind: "separator", text: "", marks: [] });
      continue;
    }

    if (trimmed.startsWith(">")) {
      if (currentKind && currentKind !== "quote") {
        flushBlock(blocks, currentKind, buffer);
        buffer = [];
      }
      currentKind = "quote";
      buffer.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }

    if (currentKind && currentKind !== "paragraph") {
      flushBlock(blocks, currentKind, buffer);
      buffer = [];
    }
    currentKind = "paragraph";
    buffer.push(rawLine);
  }

  flushBlock(blocks, currentKind, buffer);
  return blocks.length
    ? blocks
    : ([{ kind: "paragraph", text: "", marks: [] }] satisfies RichTextBlock[]);
}
